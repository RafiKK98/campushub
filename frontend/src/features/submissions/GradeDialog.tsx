import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import type { SubmissionDetail } from '../../types/api';
import { gradeSubmission } from './submissions-api';

interface GradeDialogProps {
  open: boolean;
  submission: SubmissionDetail | null;
  maxScore: number;
  onClose: () => void;
}

export const GradeDialog = ({ open, submission, maxScore, onClose }: GradeDialogProps) => {
  const queryClient = useQueryClient();
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrade(submission?.grade?.toString() ?? '');
    setFeedback(submission?.feedback ?? '');
    setError(null);
  }, [open, submission]);

  const gradeMutation = useMutation({
    mutationFn: ({ id, value, note }: { id: string; value: number; note?: string }) =>
      gradeSubmission(id, { grade: value, feedback: note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const handleSave = async () => {
    if (!submission) {
      return;
    }

    const numericGrade = Number(grade);

    if (!Number.isInteger(numericGrade) || numericGrade < 0 || numericGrade > maxScore) {
      setError(`Grade must be a whole number between 0 and ${maxScore}.`);
      return;
    }

    setError(null);

    try {
      await gradeMutation.mutateAsync({
        id: submission.id,
        value: numericGrade,
        note: feedback.trim() || undefined,
      });
      onClose();
    } catch (mutationError) {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Unable to save the grade. Please try again.',
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={gradeMutation.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Grade submission</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submission ? (
            <Typography variant="body2" color="text.secondary">
              {submission.student.name} ({submission.student.email})
            </Typography>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={`Grade (0 - ${maxScore})`}
            type="number"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            fullWidth
          />

          <TextField
            label="Feedback"
            multiline
            minRows={3}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={gradeMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          variant="contained"
          disabled={gradeMutation.isPending}
        >
          {gradeMutation.isPending ? 'Saving...' : 'Save grade'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
