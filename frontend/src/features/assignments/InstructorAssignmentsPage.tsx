import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
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
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { StatusChip } from '../../components/StatusChip';
import { ApiError } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { AssignmentDetail, AssignmentSummary } from '../../types/api';
import { AssignmentFormDialog } from './AssignmentFormDialog';
import { deleteAssignment, getAssignment, listAssignments } from './assignments-api';
import { listInstructorCourses } from '../courses/courses-api';

export const InstructorAssignmentsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments({ page, scope: 'instructor' }),
    queryFn: () => listAssignments({ page, limit: 20 }),
  });

  const coursesQuery = useQuery({
    queryKey: queryKeys.instructorCourses({ limit: 100 }),
    queryFn: () => listInstructorCourses({ limit: 100 }),
  });

  const courseById = new Map(
    (coursesQuery.data?.courses ?? []).map((course) => [course.id, course]),
  );

  const deleteMutation = useMutation({
    mutationFn: (assignment: AssignmentSummary) => deleteAssignment('instructor', assignment.id),
    onSuccess: () => {
      setActionError(null);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to delete the assignment right now.',
      );
    },
  });

  const openCreate = () => {
    setEditingAssignment(null);
    setDialogOpen(true);
  };

  const openEdit = async (assignment: AssignmentSummary) => {
    try {
      const detail = await getAssignment(assignment.id);
      setEditingAssignment(detail);
      setDialogOpen(true);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to open this assignment for editing.',
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Create assignments and review submissions."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Create assignment
          </Button>
        }
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {assignmentsQuery.isLoading ? (
              <LoadingState label="Loading assignments..." />
            ) : assignmentsQuery.isError || !assignmentsQuery.data ? (
              <ErrorState
                message="Unable to load assignments."
                onRetry={() => void assignmentsQuery.refetch()}
              />
            ) : assignmentsQuery.data.assignments.length === 0 ? (
              <EmptyState
                title="No assignments yet"
                description="Create an assignment for one of your open courses."
              />
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Course</TableCell>
                      <TableCell>Due</TableCell>
                      <TableCell>Max score</TableCell>
                      <TableCell>Grading</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignmentsQuery.data.assignments.map((assignment) => {
                      const course = courseById.get(assignment.courseId);

                      return (
                        <TableRow key={assignment.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {assignment.title}
                            </Typography>
                          </TableCell>
                          <TableCell>{course ? course.code : 'Unknown course'}</TableCell>
                          <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
                          <TableCell>{assignment.maxScore}</TableCell>
                          <TableCell>
                            <StatusChip
                              status={assignment.hasGradedSubmissions ? 'GRADED' : 'PENDING'}
                              label={assignment.hasGradedSubmissions ? 'Graded' : 'Pending'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                              <Button
                                size="small"
                                onClick={() => navigate(`/assignments/${assignment.id}`)}
                              >
                                View
                              </Button>
                              <Button
                                size="small"
                                onClick={() =>
                                  navigate(`/instructor/assignments/${assignment.id}/submissions`)
                                }
                              >
                                Submissions
                              </Button>
                              <Button
                                size="small"
                                onClick={() => {
                                  void openEdit(assignment);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => setDeleteTarget(assignment)}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <PaginationBar meta={assignmentsQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <AssignmentFormDialog
        open={dialogOpen}
        assignment={editingAssignment}
        courses={coursesQuery.data?.courses ?? []}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete assignment"
        description={
          deleteTarget ? `Delete "${deleteTarget.title}"? This also removes its submissions.` : ''
        }
        confirmLabel="Delete assignment"
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
