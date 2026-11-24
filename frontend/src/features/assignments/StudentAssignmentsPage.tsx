import {
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
import { formatDateTime } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { listAssignments } from '../assignments/assignments-api';
import { listStudentCourses } from '../courses/courses-api';

export const StudentAssignmentsPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');

  const coursesQuery = useQuery({
    queryKey: queryKeys.studentCourses({ limit: 100 }),
    queryFn: () => listStudentCourses({ limit: 100 }),
  });

  const courses = coursesQuery.data?.courses ?? [];
  const selectedCourseId = courseId || courses[0]?.id || '';

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments({ courseId: selectedCourseId, page, scope: 'student' }),
    queryFn: () => listAssignments({ courseId: selectedCourseId, page, limit: 20 }),
    enabled: Boolean(selectedCourseId),
  });

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Assignments from the courses you are enrolled in."
        action={
          <Button variant="outlined" onClick={() => navigate('/student/grades')}>
            My grades
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {coursesQuery.isLoading ? (
              <LoadingState label="Loading your courses..." />
            ) : courses.length === 0 ? (
              <EmptyState
                title="No enrolled courses"
                description="Enroll in a course to see its assignments."
                action={
                  <Button variant="contained" onClick={() => navigate('/catalogue')}>
                    Browse catalogue
                  </Button>
                }
              />
            ) : (
              <>
                <TextField
                  select
                  label="Course"
                  value={selectedCourseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    setPage(1);
                  }}
                  size="small"
                  sx={{ maxWidth: 420 }}
                >
                  {courses.map((course) => (
                    <MenuItem key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </MenuItem>
                  ))}
                </TextField>

                {assignmentsQuery.isLoading ? (
                  <LoadingState label="Loading assignments..." />
                ) : assignmentsQuery.isError || !assignmentsQuery.data ? (
                  <ErrorState
                    message="Unable to load assignments."
                    onRetry={() => void assignmentsQuery.refetch()}
                  />
                ) : assignmentsQuery.data.assignments.length === 0 ? (
                  <EmptyState
                    title="No assignments for this course"
                    description="Check back later for new assignments."
                  />
                ) : (
                  <>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Due</TableCell>
                          <TableCell>Max score</TableCell>
                          <TableCell>Grading</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {assignmentsQuery.data.assignments.map((assignment) => (
                          <TableRow key={assignment.id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {assignment.title}
                              </Typography>
                            </TableCell>
                            <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
                            <TableCell>{assignment.maxScore}</TableCell>
                            <TableCell>
                              <StatusChip
                                status={assignment.hasGradedSubmissions ? 'GRADED' : 'PENDING'}
                                label={assignment.hasGradedSubmissions ? 'Graded' : 'Pending'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                onClick={() => navigate(`/assignments/${assignment.id}`)}
                              >
                                Open
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <PaginationBar meta={assignmentsQuery.data.meta} onPageChange={setPage} />
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
};
