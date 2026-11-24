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
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { formatScheduleDay, formatTimeRange } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { CourseStatus } from '../../types/api';
import { listInstructorCourses } from './courses-api';

export const InstructorCoursesPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');

  const coursesQuery = useQuery({
    queryKey: queryKeys.instructorCourses({ page, search, status }),
    queryFn: () =>
      listInstructorCourses({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  return (
    <>
      <PageHeader
        title="My courses"
        subtitle="Courses assigned to you."
        action={
          <Button variant="contained" onClick={() => navigate('/instructor/assignments')}>
            Assignments
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

            {coursesQuery.isLoading ? (
              <LoadingState label="Loading courses..." />
            ) : coursesQuery.isError || !coursesQuery.data ? (
              <ErrorState
                message="Unable to load your courses."
                onRetry={() => void coursesQuery.refetch()}
              />
            ) : coursesQuery.data.courses.length === 0 ? (
              <EmptyState
                title="No courses assigned"
                description="An administrator will assign courses to your account."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Course</TableCell>
                      <TableCell>Term</TableCell>
                      <TableCell>Schedule</TableCell>
                      <TableCell>Students</TableCell>
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
                        <TableCell>{course.term}</TableCell>
                        <TableCell>
                          {formatScheduleDay(course.scheduleDay)}{' '}
                          {formatTimeRange(course.startTime, course.endTime)}
                        </TableCell>
                        <TableCell>{course.enrolledCount}</TableCell>
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
    </>
  );
};
