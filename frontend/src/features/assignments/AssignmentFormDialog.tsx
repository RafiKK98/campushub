import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import type { AssignmentDetail, CourseSummary } from '../../types/api';
import { createAssignment, updateAssignment, type AssignmentUpdateInput } from './assignments-api';

const assignmentSchema = z.object({
  courseId: z.string().min(1, 'Select a course.'),
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: z.string().trim().min(1, 'Description is required.').max(5000),
  dueAt: z
    .string()
    .min(1, 'Due date is required.')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid due date.'),
  maxScore: z.number().int().min(1, 'Max score must be a positive integer.'),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

interface AssignmentFormDialogProps {
  open: boolean;
  assignment: AssignmentDetail | null;
  courses: CourseSummary[];
  onClose: () => void;
}

export const AssignmentFormDialog = ({
  open,
  assignment,
  courses,
  onClose,
}: AssignmentFormDialogProps) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(assignment);
  const openCourses = useMemo(
    () => courses.filter((course) => course.status === 'OPEN'),
    [courses],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      courseId: '',
      title: '',
      description: '',
      dueAt: dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
      maxScore: 100,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServerError(null);
    reset({
      courseId: assignment?.courseId ?? openCourses[0]?.id ?? '',
      title: assignment?.title ?? '',
      description: assignment?.description ?? '',
      dueAt: assignment
        ? dayjs(assignment.dueAt).format('YYYY-MM-DDTHH:mm')
        : dayjs().add(7, 'day').format('YYYY-MM-DDTHH:mm'),
      maxScore: assignment?.maxScore ?? 100,
    });
  }, [open, assignment, openCourses, reset]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['assignment'] });
    void queryClient.invalidateQueries({ queryKey: ['course'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: AssignmentFormValues) =>
      createAssignment('instructor', {
        courseId: values.courseId,
        title: values.title,
        description: values.description,
        dueAt: new Date(values.dueAt).toISOString(),
        maxScore: values.maxScore,
      }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignmentUpdateInput }) =>
      updateAssignment('instructor', id, input),
    onSuccess: invalidate,
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const dueAtDate = new Date(values.dueAt);

    if (Number.isNaN(dueAtDate.getTime())) {
      setServerError('Enter a valid due date.');
      return;
    }

    try {
      if (assignment) {
        const input: AssignmentUpdateInput = {
          title: values.title,
          description: values.description,
          maxScore: values.maxScore,
        };

        const originalDueAt = new Date(assignment.dueAt).getTime();

        if (Math.abs(dueAtDate.getTime() - originalDueAt) > 60_000) {
          if (dueAtDate.getTime() <= now) {
            setServerError('Due date must be in the future.');
            return;
          }

          input.dueAt = dueAtDate.toISOString();
        }

        await updateMutation.mutateAsync({ id: assignment.id, input });
      } else {
        if (dueAtDate.getTime() <= now) {
          setServerError('Due date must be in the future.');
          return;
        }

        await createMutation.mutateAsync(values);
      }

      onClose();
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Unable to save the assignment. Please try again.',
      );
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit assignment' : 'Create assignment'}</DialogTitle>
      <form onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {serverError ? <Alert severity="error">{serverError}</Alert> : null}
            {!isEdit && openCourses.length === 0 ? (
              <Alert severity="info">
                You need an open course before you can create an assignment.
              </Alert>
            ) : null}

            <Controller
              control={control}
              name="courseId"
              render={({ field }) => (
                <TextField
                  select
                  label="Course"
                  fullWidth
                  {...field}
                  disabled={isEdit}
                  error={Boolean(errors.courseId)}
                  helperText={
                    isEdit
                      ? 'The course cannot be changed after creation.'
                      : errors.courseId?.message
                  }
                >
                  {(isEdit && assignment ? [assignment.course] : openCourses).map((course) => (
                    <MenuItem key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField
              label="Title"
              fullWidth
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              {...register('title')}
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={3}
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
              {...register('description')}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Due date"
                type="datetime-local"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.dueAt)}
                helperText={errors.dueAt?.message}
                {...register('dueAt')}
              />
              <TextField
                label="Max score"
                type="number"
                fullWidth
                error={Boolean(errors.maxScore)}
                helperText={errors.maxScore?.message}
                {...register('maxScore', { valueAsNumber: true })}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || (!isEdit && openCourses.length === 0)}
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create assignment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
