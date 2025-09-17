import { useState, useCallback } from 'react';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@material-ui/core';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import { Snackbar, Alert } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';

import {
  environmentsApiRef,
  Environment,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest
} from '../../api';

export const EnvironmentFetchComponent = () => {
  const environmentsApi = useApi(environmentsApiRef);

  // State management
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null);
  const [environmentToDelete, setEnvironmentToDelete] = useState<Environment | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Data fetching
  const { value: environments, loading, error } = useAsync(async (): Promise<Environment[]> => {
    try {
      return await environmentsApi.getEnvironments();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch environments');
    }
  }, [refreshIndex]);

  // Utility functions
  const showNotification = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshIndex(prev => prev + 1);
  }, []);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
  }, []);

  // Create environment handlers
  const handleCreateOpen = useCallback(() => {
    resetForm();
    setCreateDialogOpen(true);
  }, [resetForm]);

  const handleCreateClose = useCallback(() => {
    setCreateDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleCreateEnvironment = useCallback(async () => {
    if (!name.trim() || !description.trim()) {
      showNotification('Name and description are required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const request: CreateEnvironmentRequest = {
        name: name.trim(),
        description: description.trim(),
      };

      await environmentsApi.createEnvironment(request);
      showNotification('Environment created successfully', 'success');
      handleCreateClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create environment';
      showNotification(message, 'error');
    } finally {
      setIsCreating(false);
    }
  }, [name, description, environmentsApi, showNotification, handleCreateClose, handleRefresh]);

  // Edit environment handlers
  const handleEditOpen = useCallback((environment: Environment) => {
    setEditingEnvironment(environment);
    setName(environment.name);
    setDescription(environment.description);
    setEditDialogOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditDialogOpen(false);
    setEditingEnvironment(null);
    resetForm();
  }, [resetForm]);

  const handleUpdateEnvironment = useCallback(async () => {
    if (!editingEnvironment || !name.trim() || !description.trim()) {
      showNotification('Name and description are required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const request: UpdateEnvironmentRequest = {
        environmentId: editingEnvironment.environmentId,
        name: name.trim(),
        description: description.trim(),
      };

      await environmentsApi.updateEnvironment(request);
      showNotification('Environment updated successfully', 'success');
      handleEditClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update environment';
      showNotification(message, 'error');
    } finally {
      setIsUpdating(false);
    }
  }, [editingEnvironment, name, description, environmentsApi, showNotification, handleEditClose, handleRefresh]);

  // Delete environment handlers
  const handleDeleteOpen = useCallback((environment: Environment) => {
    setEnvironmentToDelete(environment);
    setDeleteConfirmation('');
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setEnvironmentToDelete(null);
    setDeleteConfirmation('');
  }, []);

  const handleDeleteEnvironment = useCallback(async () => {
    if (!environmentToDelete || deleteConfirmation !== environmentToDelete.name) {
      showNotification('Please type the environment name to confirm deletion', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await environmentsApi.deleteEnvironment(environmentToDelete.environmentId);
      showNotification('Environment deleted successfully', 'success');
      handleDeleteClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete environment';
      showNotification(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [environmentToDelete, deleteConfirmation, environmentsApi, showNotification, handleDeleteClose, handleRefresh]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Loading and error states
  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <ResponseErrorPanel
        error={error}
        title="Failed to load environments"
      />
    );
  }

  // Table configuration
  const columns: TableColumn[] = [
    { title: 'Environment ID', field: 'environmentId' },
    { title: 'Name', field: 'name' },
    { title: 'Description', field: 'description' },
    { title: 'Created By', field: 'createdBy' },
    {
      title: 'Created At',
      field: 'createdAt',
      render: (data) => {
        const row = data as Environment;
        return row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
      },
    },
    { title: 'Updated By', field: 'updatedBy' },
    {
      title: 'Updated At',
      field: 'updatedAt',
      render: (data) => {
        const row = data as Environment;
        return row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '';
      },
    },
    {
      title: 'Actions',
      field: 'actions',
      render: (data) => {
        const row = data as Environment;
        return (
          <div>
            <IconButton
              onClick={() => handleEditOpen(row)}
              size="small"
              title="Edit environment"
              disabled={isUpdating}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => handleDeleteOpen(row)}
              size="small"
              title="Delete environment"
              disabled={isDeleting}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={handleCreateOpen}
        style={{ marginBottom: 16 }}
        disabled={isCreating}
      >
        {isCreating ? 'Creating...' : 'Create Environment'}
      </Button>

      {/* Create Environment Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create Environment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isCreating}
          />
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isCreating}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateEnvironment}
            color="primary"
            disabled={!name.trim() || !description.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Environment Dialog */}
      <Dialog open={editDialogOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Environment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isUpdating}
          />
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isUpdating}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdateEnvironment}
            color="primary"
            disabled={!name.trim() || !description.trim() || isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Environment Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Environment</DialogTitle>
        <DialogContent>
          <p>
            This action cannot be undone. Type the environment name{' '}
            <strong>{environmentToDelete?.name}</strong> to confirm deletion:
          </p>
          <TextField
            autoFocus
            margin="dense"
            label="Environment Name"
            type="text"
            fullWidth
            value={deleteConfirmation}
            onChange={e => setDeleteConfirmation(e.target.value)}
            disabled={isDeleting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteEnvironment}
            color="primary"
            disabled={deleteConfirmation !== environmentToDelete?.name || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Environments Table */}
      <Table
        title=""
        options={{
          search: true,
          paging: true,
          pageSize: 10,
          emptyRowsWhenPaging: false,
        }}
        columns={columns}
        data={(environments || []).map(env => ({
          ...env,
          id: env.environmentId, // Add unique ID for table rows
        }))}
      />

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'success' ? 4000 : 6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
