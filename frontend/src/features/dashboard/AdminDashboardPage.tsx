import { useQuery } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { queryKeys } from '../../lib/query-keys';
import { getAdminOverview } from './dashboard-api';

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const overviewQuery = useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: getAdminOverview,
  });

  if (overviewQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        message="Unable to load the admin dashboard."
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  const overview = overviewQuery.data;

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Platform-wide activity at a glance."
        action={
          <Button variant="contained" onClick={() => navigate('/admin/courses')}>
            Manage courses
          </Button>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <StatCard label="Students" value={overview.totalStudents} />
        <StatCard label="Instructors" value={overview.totalInstructors} />
        <StatCard label="Active courses" value={overview.activeCourses} helper="Status OPEN" />
        <StatCard
          label="Enrollments"
          value={overview.totalEnrollments}
          helper="Currently enrolled"
        />
      </Box>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Quick actions</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="outlined" onClick={() => navigate('/admin/users')}>
                Manage users
              </Button>
              <Button variant="outlined" onClick={() => navigate('/admin/courses')}>
                Manage courses
              </Button>
              <Button variant="outlined" onClick={() => navigate('/announcements')}>
                Post announcement
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
