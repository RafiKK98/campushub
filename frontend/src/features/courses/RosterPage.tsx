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
import { useAuth } from '../../features/auth/auth-context';
import { formatDate } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { getCourse, getRoster, type RosterScope } from './courses-api';

export const RosterPage = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = id ?? '';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const scope: RosterScope = user?.role === 'ADMIN' ? 'admin' : 'instructor';

  const courseQuery = useQuery({
    queryKey: queryKeys.course(courseId),
    queryFn: () => getCourse(courseId),
    enabled: Boolean(courseId),
  });

  const rosterQuery = useQuery({
    queryKey: queryKeys.roster(courseId, { page, search, scope }),
    queryFn: () =>
      getRoster(scope, courseId, {
        page,
        limit: 20,
        search: search || undefined,
        status: 'ENROLLED',
      }),
    enabled: Boolean(courseId),
  });

  if (!courseId) {
    return <ErrorState message="The course identifier is missing." />;
  }

  if (courseQuery.isLoading) {
    return <LoadingState label="Loading roster..." />;
  }

  if (courseQuery.isError || !courseQuery.data) {
    return (
      <ErrorState
        message="Unable to load this course."
        onRetry={() => void courseQuery.refetch()}
      />
    );
  }

  const course = courseQuery.data;

  return (
    <>
      <PageHeader
        title={`Roster - ${course.code}`}
        subtitle={`${course.title} · ${course.enrolledCount} enrolled`}
        action={
          <Button variant="text" onClick={() => navigate(`/courses/${course.id}`)}>
            Back to course
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
                  label="Search students"
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

            {rosterQuery.isLoading ? (
              <LoadingState label="Loading students..." />
            ) : rosterQuery.isError || !rosterQuery.data ? (
              <ErrorState
                message="Unable to load the roster."
                onRetry={() => void rosterQuery.refetch()}
              />
            ) : rosterQuery.data.enrollments.length === 0 ? (
              <EmptyState
                title="No enrolled students"
                description="Students will appear here once they enroll."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Enrolled</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rosterQuery.data.enrollments.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entry.student.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{entry.student.email}</TableCell>
                        <TableCell>
                          <StatusChip status={entry.status} />
                        </TableCell>
                        <TableCell>{formatDate(entry.enrolledAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <PaginationBar meta={rosterQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
