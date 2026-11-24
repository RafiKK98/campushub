import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PaginationBar } from '../../components/PaginationBar';
import { useAuth } from '../../features/auth/auth-context';
import { ApiError } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format';
import { queryKeys } from '../../lib/query-keys';
import type { AnnouncementSummary } from '../../types/api';
import { listInstructorCourses } from '../courses/courses-api';
import { AnnouncementFormDialog } from './AnnouncementFormDialog';
import { deleteAnnouncement, listAnnouncements } from './announcements-api';

export const AnnouncementsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  const announcementsQuery = useQuery({
    queryKey: queryKeys.announcements({ page, search }),
    queryFn: () => listAnnouncements({ page, limit: 10, search: search || undefined }),
  });

  const coursesQuery = useQuery({
    queryKey: queryKeys.instructorCourses({ limit: 100 }),
    queryFn: () => listInstructorCourses({ limit: 100 }),
    enabled: user?.role === 'INSTRUCTOR',
  });

  const deleteMutation = useMutation({
    mutationFn: (announcement: AnnouncementSummary) => deleteAnnouncement(announcement.id),
    onSuccess: () => {
      setActionError(null);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError ? error.message : 'Unable to delete the announcement right now.',
      );
    },
  });

  const canManage = (announcement: AnnouncementSummary) =>
    user?.role === 'ADMIN' || announcement.author.id === user?.id;

  const openCreate = () => {
    setEditingAnnouncement(null);
    setDialogOpen(true);
  };

  const openEdit = (announcement: AnnouncementSummary) => {
    setEditingAnnouncement(announcement);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Global updates and course-specific notices."
        action={
          canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New announcement
            </Button>
          ) : undefined
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
                  label="Search announcements"
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

            {actionError ? <Alert severity="error">{actionError}</Alert> : null}

            {announcementsQuery.isLoading ? (
              <LoadingState label="Loading announcements..." />
            ) : announcementsQuery.isError || !announcementsQuery.data ? (
              <ErrorState
                message="Unable to load announcements."
                onRetry={() => void announcementsQuery.refetch()}
              />
            ) : announcementsQuery.data.announcements.length === 0 ? (
              <EmptyState
                title="No announcements"
                description="Announcements will appear here when they are published."
              />
            ) : (
              <>
                <Stack spacing={2}>
                  {announcementsQuery.data.announcements.map((announcement) => (
                    <Card key={announcement.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                            sx={{
                              justifyContent: 'space-between',
                              alignItems: { xs: 'flex-start', sm: 'center' },
                            }}
                          >
                            <Typography variant="h6">{announcement.title}</Typography>
                            <Chip
                              size="small"
                              color={announcement.course ? 'primary' : 'default'}
                              label={announcement.course ? announcement.course.code : 'Global'}
                              variant={announcement.course ? 'filled' : 'outlined'}
                            />
                          </Stack>

                          <Typography variant="caption" color="text.secondary">
                            {announcement.author.name} · {formatDateTime(announcement.publishedAt)}
                          </Typography>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: 'pre-line' }}
                          >
                            {announcement.body}
                          </Typography>

                          {canManage(announcement) ? (
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                              <Button size="small" onClick={() => openEdit(announcement)}>
                                Edit
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => setDeleteTarget(announcement)}
                              >
                                Delete
                              </Button>
                            </Stack>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>

                <PaginationBar meta={announcementsQuery.data.meta} onPageChange={setPage} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {user ? (
        <AnnouncementFormDialog
          open={dialogOpen}
          announcement={editingAnnouncement}
          courses={coursesQuery.data?.courses ?? []}
          role={user.role}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete announcement"
        description={deleteTarget ? `Delete "${deleteTarget.title}"? This cannot be undone.` : ''}
        confirmLabel="Delete announcement"
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
