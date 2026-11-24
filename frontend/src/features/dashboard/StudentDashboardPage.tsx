import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { StatusChip } from '../../components/StatusChip';
import { formatDateTime, formatPercent, isPast } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { getStudentOverview } from './dashboard-api';

export const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const overviewQuery = useQuery({
    queryKey: queryKeys.studentOverview,
    queryFn: getStudentOverview,
  });

  if (overviewQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        message="Unable to load the student dashboard."
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <>
      <PageHeader
        title="Student dashboard"
        subtitle="Keep track of your courses, deadlines, and grades."
        action={
          <Button variant="contained" onClick={() => navigate('/catalogue')}>
            Browse catalogue
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <StatCard label="Enrolled courses" value={overview.enrolledCoursesCount} />
        <StatCard
          label="Average grade"
          value={formatPercent(overview.gradeSummary.averagePercentage)}
          helper="Across graded submissions"
        />
        <StatCard label="Graded submissions" value={overview.gradeSummary.gradedSubmissions} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
          gap: 3,
          mt: 3,
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Upcoming assignments</Typography>
                <Button size="small" onClick={() => navigate('/student/assignments')}>
                  View all
                </Button>
              </Stack>

              {overview.upcomingAssignments.length === 0 ? (
                <EmptyState
                  title="Nothing due soon"
                  description="New assignments from your enrolled courses will appear here."
                />
              ) : (
                <List disablePadding>
                  {overview.upcomingAssignments.map((assignment, index) => {
                    const submission = assignment.submission;
                    const status = submission
                      ? submission.gradedAt
                        ? { status: 'GRADED', label: 'Graded' }
                        : { status: 'SUBMITTED', label: 'Submitted' }
                      : isPast(assignment.dueAt)
                        ? { status: 'LATE', label: 'Overdue' }
                        : { status: 'PENDING', label: 'Not submitted' };

                    return (
                      <Box key={assignment.id}>
                        {index > 0 ? <Divider component="li" /> : null}
                        <ListItem
                          disableGutters
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/assignments/${assignment.id}`)}
                          secondaryAction={
                            <StatusChip status={status.status} label={status.label} />
                          }
                        >
                          <ListItemText
                            primary={assignment.title}
                            secondary={`${assignment.course.code} · Due ${formatDateTime(assignment.dueAt)}`}
                          />
                        </ListItem>
                      </Box>
                    );
                  })}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Recent announcements</Typography>

              {overview.recentAnnouncements.length === 0 ? (
                <EmptyState title="No announcements yet" />
              ) : (
                <List disablePadding>
                  {overview.recentAnnouncements.map((announcement, index) => (
                    <Box key={announcement.id}>
                      {index > 0 ? <Divider component="li" /> : null}
                      <ListItem disableGutters>
                        <ListItemText
                          primary={announcement.title}
                          secondary={`${announcement.course?.code ?? 'Global'} · ${formatDateTime(announcement.publishedAt)}`}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}

              <Button size="small" onClick={() => navigate('/announcements')}>
                All announcements
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </>
  );
};
