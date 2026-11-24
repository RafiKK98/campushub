import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../features/auth/auth-context';
import { ApiError } from '../../lib/api-client';
import { formatDateTime, formatGrade, isPast } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import { getMySubmission, submitAssignment } from '../submissions/submissions-api';
import { getAssignment } from './assignments-api';

export const AssignmentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const assignmentId = id ?? '';
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const assignmentQuery = useQuery({
    queryKey: queryKeys.assignment(assignmentId),
    queryFn: () => getAssignment(assignmentId),
    enabled: Boolean(assignmentId),
  });

  const submissionQuery = useQuery({
    queryKey: queryKeys.mySubmission(assignmentId),
    queryFn: () => getMySubmission(assignmentId),
    enabled: Boolean(assignmentId) && user?.role === 'STUDENT',
  });

  const submission = submissionQuery.data ?? null;

  useEffect(() => {
    if (submission) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent(submission.content);
    }
  }, [submission]);

  const submitMutation = useMutation({
    mutationFn: (text: string) => submitAssignment(assignmentId, text),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['my-submission', assignmentId] });
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to submit this assignment right now.',
      );
    },
  });

  if (!assignmentId) {
    return <ErrorState message="The assignment identifier is missing." />;
  }

  if (assignmentQuery.isLoading) {
    return <LoadingState label="Loading assignment..." />;
  }

  if (assignmentQuery.isError || !assignmentQuery.data) {
    return (
      <ErrorState
        message="Unable to load this assignment."
        onRetry={() => void assignmentQuery.refetch()}
      />
    );
  }

  const assignment = assignmentQuery.data;
  const isOwnerInstructor =
    user?.role === 'INSTRUCTOR' && assignment.course.instructor.id === user.id;
  const isPastDue = isPast(assignment.dueAt);
  const canResubmit = Boolean(submission) && !submission?.gradedAt && !isPastDue;

  const handleSubmit = () => {
    if (content.trim().length === 0) {
      setActionError('Submission content cannot be empty.');
      return;
    }

    submitMutation.mutate(content.trim());
  };

  return (
    <>
      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.course.code} - ${assignment.course.title}`}
        action={
          <Button variant="text" onClick={() => navigate(-1)}>
            Back
          </Button>
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
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Due
              </Typography>
              <Typography>{formatDateTime(assignment.dueAt)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Max score
              </Typography>
              <Typography>{assignment.maxScore}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Grading
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <StatusChip
                  status={assignment.hasGradedSubmissions ? 'GRADED' : 'PENDING'}
                  label={assignment.hasGradedSubmissions ? 'Graded submissions' : 'Pending'}
                />
              </Box>
            </Box>
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>
            Instructions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {assignment.description}
          </Typography>

          {isOwnerInstructor ? (
            <Button
              variant="contained"
              sx={{ mt: 3 }}
              onClick={() => navigate(`/instructor/assignments/${assignment.id}/submissions`)}
            >
              Review submissions
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {user?.role === 'STUDENT' ? (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Your submission
            </Typography>

            {submissionQuery.isLoading ? (
              <LoadingState label="Loading your submission..." />
            ) : submissionQuery.isError ? (
              <ErrorState
                message="Unable to load your submission."
                onRetry={() => void submissionQuery.refetch()}
              />
            ) : submission ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <StatusChip
                    status={submission.gradedAt ? 'GRADED' : 'SUBMITTED'}
                    label={submission.gradedAt ? 'Graded' : 'Submitted'}
                  />
                  {submission.isLate ? <StatusChip status="LATE" /> : null}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Submitted
                    </Typography>
                    <Typography>{formatDateTime(submission.submittedAt)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Grade
                    </Typography>
                    <Typography>{formatGrade(submission.grade, assignment.maxScore)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Graded at
                    </Typography>
                    <Typography>
                      {submission.gradedAt ? formatDateTime(submission.gradedAt) : 'Not graded yet'}
                    </Typography>
                  </Box>
                </Box>

                <Divider />

                {canResubmit ? (
                  <Stack spacing={2}>
                    <TextField
                      label="Update your submission"
                      multiline
                      minRows={5}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      fullWidth
                    />
                    <Box>
                      <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? 'Saving...' : 'Update submission'}
                      </Button>
                    </Box>
                  </Stack>
                ) : (
                  <>
                    <Typography variant="subtitle2">Submitted content</Typography>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-line', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}
                    >
                      {submission.content}
                    </Typography>
                    {submission.gradedAt ? (
                      <Alert severity="info">
                        Graded submissions cannot be edited.
                        {submission.feedback ? ` Feedback: ${submission.feedback}` : ''}
                      </Alert>
                    ) : (
                      <Alert severity="info">
                        The due date has passed, so this submission can no longer be updated.
                      </Alert>
                    )}
                  </>
                )}
              </Stack>
            ) : (
              <Stack spacing={2}>
                {isPastDue ? (
                  <Alert severity="warning">
                    The due date has passed. You can still submit once, but it will be marked late.
                  </Alert>
                ) : null}
                <TextField
                  label="Your submission"
                  multiline
                  minRows={6}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  fullWidth
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit assignment'}
                  </Button>
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
      ) : null}

      {user?.role === 'ADMIN' ? (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <EmptyState
              title="Administrator view"
              description="Admins can view assignment details but grading is performed by instructors."
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
};
