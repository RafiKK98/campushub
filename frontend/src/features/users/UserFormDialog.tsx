import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import type { UserSummary } from '../../types/api';
import { createUser, updateUser, type UpdateUserInput } from './users-api';

const buildSchema = (isEdit: boolean) =>
  z
    .object({
      name: z.string().trim().min(1, 'Name is required.').max(200),
      email: z
        .string()
        .trim()
        .min(1, 'Email is required.')
        .pipe(z.email('Enter a valid email address.')),
      role: z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']),
      password: z.string(),
      isActive: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (!isEdit && value.password.length < 8) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'Password must be at least 8 characters.',
        });
      }

      if (isEdit && value.password.length > 0 && value.password.length < 8) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'Password must be at least 8 characters.',
        });
      }
    });

type UserFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface UserFormDialogProps {
  open: boolean;
  user: UserSummary | null;
  currentUserId: string;
  onClose: () => void;
}

export const UserFormDialog = ({ open, user, currentUserId, onClose }: UserFormDialogProps) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(user);
  const isSelf = user?.id === currentUserId;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(buildSchema(isEdit)),
    defaultValues: {
      name: '',
      email: '',
      role: 'STUDENT',
      password: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServerError(null);
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'STUDENT',
      password: '',
      isActive: user?.isActive ?? true,
    });
  }, [open, user, reset]);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      if (user) {
        const input: UpdateUserInput = {
          name: values.name,
          role: values.role,
          isActive: values.isActive,
        };

        if (values.password) {
          input.password = values.password;
        }

        await updateMutation.mutateAsync({ id: user.id, input });
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password,
          isActive: values.isActive,
        });
      }

      onClose();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Unable to save the user. Please try again.',
      );
    }
  });

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
      <form onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {serverError ? <Alert severity="error">{serverError}</Alert> : null}

            <TextField
              label="Name"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              {...register('name')}
            />

            <TextField
              label="Email"
              type="email"
              fullWidth
              disabled={isEdit}
              error={Boolean(errors.email)}
              helperText={
                isEdit ? 'Email cannot be changed after creation.' : errors.email?.message
              }
              {...register('email')}
            />

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <TextField
                  select
                  label="Role"
                  fullWidth
                  {...field}
                  disabled={isSelf}
                  helperText={isSelf ? 'You cannot change your own role.' : undefined}
                >
                  <MenuItem value="ADMIN">Administrator</MenuItem>
                  <MenuItem value="INSTRUCTOR">Instructor</MenuItem>
                  <MenuItem value="STUDENT">Student</MenuItem>
                </TextField>
              )}
            />

            <TextField
              label={isEdit ? 'New password' : 'Password'}
              type="password"
              fullWidth
              autoComplete="new-password"
              error={Boolean(errors.password)}
              helperText={
                errors.password?.message ??
                (isEdit ? 'Leave blank to keep the current password.' : 'At least 8 characters.')
              }
              {...register('password')}
            />

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      disabled={isSelf}
                    />
                  }
                  label={
                    isSelf ? 'Active account (you cannot deactivate yourself)' : 'Active account'
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
