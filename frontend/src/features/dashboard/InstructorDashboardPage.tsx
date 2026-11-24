import { useQuery } from '@tanstack/react-query';
import {
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
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { StatusChip } from '../../components/StatusChip';
import { formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { getInstructorOverview } from './dashboard-api';

export const InstructorDashboardPage = () => {
  const navigate = useNavigate();
  const overviewQuery = useQuery({
    queryKey: queryKeys.instructorOverview,
    queryFn: getInstructorOverview,
  });

  if (overviewQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        message="Unable to load the instructor dashboard."
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <>
      <PageHeader
        title="Instructor dashboard"
        subtitle="Your courses, students, and grading workload."
        action={
          <Button variant="contained" onClick={() => navigate('/instructor/assignments')}>
            Manage assignments
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 2,
        }}
      >
        <StatCard label="Courses" value={overview.totalCourses} />
        <StatCard label="Students" value={overview.totalStudents} />
        <StatCard label="Assignments" value={overview.totalAssignments} />
        <StatCard label="Pending grading" value={overview.pendingGrading} />
        <StatCard label="Graded submissions" value={overview.gradedSubmissions} />
      </Box>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Your courses</Typography>
              <Button size="small" onClick={() => navigate('/instructor/courses')}>
                View all
              </Button>
            </Stack>

            {overview.courses.length === 0 ? (
              <EmptyState
                title="No courses assigned yet"
                description="An administrator will assign courses to your account."
              />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Course</TableCell>
                    <TableCell>Term</TableCell>
                    <TableCell>Schedule</TableCell>
                    <TableCell>Students</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.courses.map((course) => (
                    <TableRow
                      key={course.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {course.code}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {course.title}
                        </Typography>
                      </TableCell>
                      <TableCell>{course.term}</TableCell>
                      <TableCell>
                        {formatScheduleDay(course.scheduleDay)}{' '}
                        {formatTimeRange(course.startTime, course.endTime)}
                      </TableCell>
                      <TableCell>{course.enrolledCount}</TableCell>
                      <TableCell>
                        <StatusChip status={course.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
