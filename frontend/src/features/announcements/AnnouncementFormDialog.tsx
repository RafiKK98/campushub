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
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import type { AnnouncementSummary, CourseSummary, Role } from '../../types/api';
import {
  createAnnouncement,
  updateAnnouncement,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from './announcements-api';

const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  body: z.string().trim().min(1, 'Body is required.').max(5000),
  courseId: z.string(),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

interface AnnouncementFormDialogProps {
  open: boolean;
  announcement: AnnouncementSummary | null;
  courses: CourseSummary[];
  role: Role;
  onClose: () => void;
}

export const AnnouncementFormDialog = ({
  open,
  announcement,
  courses,
  role,
  onClose,
}: AnnouncementFormDialogProps) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(announcement);
  const isInstructor = role === 'INSTRUCTOR';

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '', courseId: '' },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServerError(null);
    reset({
      title: announcement?.title ?? '',
      body: announcement?.body ?? '',
      courseId: announcement?.courseId ?? (isInstructor ? (courses[0]?.id ?? '') : ''),
    });
  }, [open, announcement, courses, isInstructor, reset]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['announcements'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateAnnouncementInput) => createAnnouncement(input),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementInput }) =>
      updateAnnouncement(id, input),
    onSuccess: invalidate,
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (isInstructor && !isEdit && !values.courseId) {
      setServerError('Select a course for your announcement.');
      return;
    }

    try {
      if (announcement) {
        await updateMutation.mutateAsync({
          id: announcement.id,
          input: { title: values.title, body: values.body },
        });
      } else {
        await createMutation.mutateAsync({
          title: values.title,
          body: values.body,
          courseId: isInstructor ? values.courseId : null,
        });
      }

      onClose();
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Unable to save the announcement. Please try again.',
      );
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit announcement' : 'New announcement'}</DialogTitle>
      <form onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {serverError ? <Alert severity="error">{serverError}</Alert> : null}

            <TextField
              label="Title"
              fullWidth
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              {...register('title')}
            />

            <TextField
              label="Body"
              fullWidth
              multiline
              minRows={5}
              error={Boolean(errors.body)}
              helperText={errors.body?.message}
              {...register('body')}
            />

            {isEdit ? (
              <Typography variant="body2" color="text.secondary">
                Audience: {announcement?.course ? announcement.course.code : 'Global'}. The audience
                cannot be changed after publishing.
              </Typography>
            ) : isInstructor ? (
              <Controller
                control={control}
                name="courseId"
                render={({ field }) => (
                  <TextField select label="Course" fullWidth {...field}>
                    {courses.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                This announcement will be visible to everyone as a global announcement.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Publish'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
