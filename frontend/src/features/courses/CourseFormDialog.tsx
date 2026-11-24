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
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import type { CourseDetail, UserSummary, Weekday } from '../../types/api';
import {
  createCourse,
  updateCourse,
  type CourseInput,
  type CourseUpdateInput,
} from './courses-api';

const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const courseSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,4}-\d{4}$/, 'Use a code like CSE-2201.'),
    title: z.string().trim().min(1, 'Title is required.').max(200),
    description: z.string().trim().min(1, 'Description is required.').max(5000),
    credits: z.number().int().min(1).max(12),
    capacity: z.number().int().min(1).max(500),
    term: z.string().trim().min(1, 'Term is required.').max(50),
    scheduleDay: z.enum(WEEKDAYS),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.'),
    room: z.string().trim().min(1, 'Room is required.').max(50),
    status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED']),
    instructorId: z.string().min(1, 'Select an instructor.'),
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ['endTime'],
    message: 'End time must be after start time.',
  });

type CourseFormValues = z.infer<typeof courseSchema>;

interface CourseFormDialogProps {
  open: boolean;
  course: CourseDetail | null;
  instructors: UserSummary[];
  onClose: () => void;
}

export const CourseFormDialog = ({ open, course, instructors, onClose }: CourseFormDialogProps) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(course);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      code: '',
      title: '',
      description: '',
      credits: 3,
      capacity: 30,
      term: 'Fall 2026',
      scheduleDay: 'MONDAY',
      startTime: '09:00',
      endTime: '10:00',
      room: '',
      status: 'DRAFT',
      instructorId: '',
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServerError(null);
    reset({
      code: course?.code ?? '',
      title: course?.title ?? '',
      description: course?.description ?? '',
      credits: course?.credits ?? 3,
      capacity: course?.capacity ?? 30,
      term: course?.term ?? 'Fall 2026',
      scheduleDay: course?.scheduleDay ?? 'MONDAY',
      startTime: course?.startTime ?? '09:00',
      endTime: course?.endTime ?? '10:00',
      room: course?.room ?? '',
      status: course?.status ?? 'DRAFT',
      instructorId: course?.instructor.id ?? instructors[0]?.id ?? '',
    });
  }, [open, course, instructors, reset]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    void queryClient.invalidateQueries({ queryKey: ['instructor-courses'] });
    void queryClient.invalidateQueries({ queryKey: ['course'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CourseInput) => createCourse(input),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CourseUpdateInput }) =>
      updateCourse(id, input),
    onSuccess: invalidate,
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      if (course) {
        await updateMutation.mutateAsync({ id: course.id, input: values });
      } else {
        await createMutation.mutateAsync(values);
      }

      onClose();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Unable to save the course. Please try again.',
      );
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Edit course' : 'Create course'}</DialogTitle>
      <form onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {serverError ? <Alert severity="error">{serverError}</Alert> : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Code"
                fullWidth
                error={Boolean(errors.code)}
                helperText={errors.code?.message ?? 'Example: CSE-2201'}
                {...register('code')}
              />
              <TextField
                label="Title"
                fullWidth
                error={Boolean(errors.title)}
                helperText={errors.title?.message}
                {...register('title')}
              />
            </Stack>

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
                label="Credits"
                type="number"
                fullWidth
                error={Boolean(errors.credits)}
                helperText={errors.credits?.message}
                {...register('credits', { valueAsNumber: true })}
              />
              <TextField
                label="Capacity"
                type="number"
                fullWidth
                error={Boolean(errors.capacity)}
                helperText={errors.capacity?.message}
                {...register('capacity', { valueAsNumber: true })}
              />
              <TextField
                label="Term"
                fullWidth
                error={Boolean(errors.term)}
                helperText={errors.term?.message}
                {...register('term')}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                control={control}
                name="scheduleDay"
                render={({ field }) => (
                  <TextField select label="Day" fullWidth {...field}>
                    {WEEKDAYS.map((day) => (
                      <MenuItem key={day} value={day}>
                        {day.charAt(0) + day.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label="Start time"
                type="time"
                fullWidth
                error={Boolean(errors.startTime)}
                helperText={errors.startTime?.message}
                {...register('startTime')}
              />
              <TextField
                label="End time"
                type="time"
                fullWidth
                error={Boolean(errors.endTime)}
                helperText={errors.endTime?.message}
                {...register('endTime')}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Room"
                fullWidth
                error={Boolean(errors.room)}
                helperText={errors.room?.message}
                {...register('room')}
              />
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <TextField select label="Status" fullWidth {...field}>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="OPEN">Open</MenuItem>
                    <MenuItem value="CLOSED">Closed</MenuItem>
                    <MenuItem value="ARCHIVED">Archived</MenuItem>
                  </TextField>
                )}
              />
              <Controller
                control={control}
                name="instructorId"
                render={({ field }) => (
                  <TextField
                    select
                    label="Instructor"
                    fullWidth
                    {...field}
                    error={Boolean(errors.instructorId)}
                    helperText={errors.instructorId?.message}
                  >
                    {instructors.map((instructor) => (
                      <MenuItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create course'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
