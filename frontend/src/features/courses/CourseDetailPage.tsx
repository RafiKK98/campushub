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
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../features/auth/auth-context';
import { ApiError } from '../../lib/api-client';
import { formatDateTime, formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { listAssignments } from '../assignments/assignments-api';
import { dropCourse, enrollInCourse, getCourse } from './courses-api';

export const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = id ?? '';
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);

  const courseQuery = useQuery({
    queryKey: queryKeys.course(courseId),
    queryFn: () => getCourse(courseId),
    enabled: Boolean(courseId),
  });

  const course = courseQuery.data;
  const isEnrolled = course?.viewerEnrollmentStatus === 'ENROLLED';
  const canViewAssignments = user?.role !== 'STUDENT' || isEnrolled;

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments({ courseId, scope: 'course' }),
    queryFn: () => listAssignments({ courseId, limit: 100 }),
    enabled: Boolean(courseId) && canViewAssignments,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['course'] });
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
    void queryClient.invalidateQueries({ queryKey: ['student-courses'] });
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const enrollMutation = useMutation({
    mutationFn: () => enrollInCourse(courseId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to enroll in this course right now.',
      );
    },
  });

  const dropMutation = useMutation({
    mutationFn: () => dropCourse(courseId),
    onSuccess: () => {
      setActionError(null);
      setDropConfirmOpen(false);
      invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to drop this course right now.',
      );
    },
  });

  if (!courseId) {
    return <ErrorState message="The course identifier is missing." />;
  }

  if (courseQuery.isLoading) {
    return <LoadingState label="Loading course..." />;
  }

  if (courseQuery.isError || !course) {
    return (
      <ErrorState
        message="Unable to load this course."
        onRetry={() => void courseQuery.refetch()}
      />
    );
  }

  const isOwnerInstructor = user?.role === 'INSTRUCTOR' && course.instructor.id === user.id;

  return (
    <>
      <PageHeader
        title={`${course.code} - ${course.title}`}
        subtitle={`${course.term} · ${formatScheduleDay(course.scheduleDay)} ${formatTimeRange(course.startTime, course.endTime)} · ${course.room}`}
        action={
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="text" onClick={() => navigate(-1)}>
              Back
            </Button>
            {user?.role === 'ADMIN' || isOwnerInstructor ? (
              <Button variant="outlined" onClick={() => navigate(`/courses/${course.id}/students`)}>
                Roster
              </Button>
            ) : null}
            {isOwnerInstructor ? (
              <Button variant="contained" onClick={() => navigate('/instructor/assignments')}>
                Manage assignments
              </Button>
            ) : null}
            {user?.role === 'STUDENT' && course.status === 'OPEN' && !isEnrolled ? (
              <Button
                variant="contained"
                disabled={enrollMutation.isPending}
                onClick={() => enrollMutation.mutate()}
              >
                Enroll
              </Button>
            ) : null}
            {user?.role === 'STUDENT' && isEnrolled ? (
              <Button variant="outlined" color="error" onClick={() => setDropConfirmOpen(true)}>
                Drop course
              </Button>
            ) : null}
          </Stack>
        }
      />

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Instructor
              </Typography>
              <Typography>{course.instructor.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {course.instructor.email}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Credits
              </Typography>
              <Typography>{course.credits}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Seats
              </Typography>
              <Typography>
                {course.enrolledCount} / {course.capacity} ({course.availableSeats} available)
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusChip status={course.status} />
              </Box>
            </Box>
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>
            About this course
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {course.description}
          </Typography>

          {user?.role === 'STUDENT' ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Your enrollment
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusChip
                  status={course.viewerEnrollmentStatus ?? 'NOT_ENROLLED'}
                  label={isEnrolled ? 'Enrolled' : 'Not enrolled'}
                />
              </Box>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Assignments
          </Typography>

          {!canViewAssignments ? (
            <EmptyState
              title="Enroll to see assignments"
              description="Assignments become available after you enroll in this course."
            />
          ) : assignmentsQuery.isLoading ? (
            <LoadingState label="Loading assignments..." />
          ) : assignmentsQuery.isError || !assignmentsQuery.data ? (
            <ErrorState
              message="Unable to load assignments."
              onRetry={() => void assignmentsQuery.refetch()}
            />
          ) : assignmentsQuery.data.assignments.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Max score</TableCell>
                  <TableCell>Grading</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignmentsQuery.data.assignments.map((assignment) => (
                  <TableRow
                    key={assignment.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/assignments/${assignment.id}`)}
                  >
                    <TableCell>{assignment.title}</TableCell>
                    <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
                    <TableCell>{assignment.maxScore}</TableCell>
                    <TableCell>
                      <StatusChip
                        status={assignment.hasGradedSubmissions ? 'GRADED' : 'PENDING'}
                        label={assignment.hasGradedSubmissions ? 'Graded' : 'Pending'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dropConfirmOpen}
        title="Drop course"
        description={`Drop ${course.code}? You will lose access to its assignments.`}
        confirmLabel="Drop course"
        loading={dropMutation.isPending}
        onConfirm={() => dropMutation.mutate()}
        onClose={() => setDropConfirmOpen(false)}
      />
    </>
  );
};
