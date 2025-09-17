import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel
} from '@backstage/core-components';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
} from '@material-ui/core';
import { Edit as EditIcon, Delete as DeleteIcon } from '@material-ui/icons';
import { Snackbar, Alert } from '@mui/material';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';

import {
  componentsApiRef,
  Component,
  Project,
  CreateComponentRequest,
  UpdateComponentRequest
} from '../../api';

interface IComponentFetchComponentProps {
  projectId?: string;
}

export const IComponentFetchComponent = ({ projectId }: IComponentFetchComponentProps) => {
  const componentsApi = useApi(componentsApiRef);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract projectId from URL parameters only once for initial value
  const urlParams = new URLSearchParams(location.search);
  const urlProjectId = urlParams.get('projectId') || projectId || '';

  console.log('IComponentFetchComponent rendered with projectId:', projectId);
  console.log('URL projectId:', urlProjectId);

  // State management - track if user has manually changed the selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId); // Use URL projectId or prop
  const [hasUserSelectedProject, setHasUserSelectedProject] = useState<boolean>(false); // Track manual selection
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
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

  // Fetch projects
  const { value: projects, loading: projectsLoading, error: projectsError } = useAsync(async (): Promise<Project[]> => {
    try {
      return await componentsApi.getProjects();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch projects');
    }
  }, []);

  // Fetch components based on selected project
  const { value: components, loading: componentsLoading, error: componentsError } = useAsync(async (): Promise<Component[]> => {
    if (!selectedProjectId) return []; // Don't load anything if no project is selected
    try {
      return await componentsApi.getComponents(selectedProjectId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch components');
    }
  }, [selectedProjectId, refreshIndex]);

  // Set first project as default when projects are loaded (only if no projectId is provided and user hasn't selected)
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId && !urlProjectId && !hasUserSelectedProject) {
      setSelectedProjectId(projects[0].projectId);
    }
  }, [projects, selectedProjectId, urlProjectId, hasUserSelectedProject]);

  // Set the provided projectId when available and projects are loaded (only if user hasn't manually selected)
  useEffect(() => {
    if (urlProjectId && projects && projects.length > 0 && !hasUserSelectedProject) {
      // Verify that the provided projectId exists in the projects list
      const projectExists = projects.some(project => project.projectId === urlProjectId);
      if (projectExists) {
        setSelectedProjectId(urlProjectId);
      } else {
        // If provided projectId doesn't exist, fall back to first project
        setSelectedProjectId(projects[0].projectId);
      }
    }
  }, [urlProjectId, projects, hasUserSelectedProject]);

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

  // Project selection handler
  const handleProjectChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedProjectId(event.target.value as string);
    setHasUserSelectedProject(true); // Mark that user has manually selected a project
  }, []);

  // Create component handlers
  const handleCreateOpen = useCallback(() => {
    resetForm();
    setCreateDialogOpen(true);
  }, [resetForm]);

  const handleCreateClose = useCallback(() => {
    setCreateDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleCreateComponent = useCallback(async () => {
    if (!selectedProjectId || !name.trim() || !description.trim()) {
      showNotification('Please select a project and provide name and description', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const request: CreateComponentRequest = {
        projectId: selectedProjectId,
        name: name.trim(),
        description: description.trim(),
      };

      await componentsApi.createComponent(request);
      showNotification('Component created successfully', 'success');
      handleCreateClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create component';
      showNotification(message, 'error');
    } finally {
      setIsCreating(false);
    }
  }, [selectedProjectId, name, description, componentsApi, showNotification, handleCreateClose, handleRefresh]);

  // Edit component handlers
  const handleEditOpen = useCallback((component: Component) => {
    setEditingComponent(component);
    setName(component.name);
    setDescription(component.description);
    setEditDialogOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditDialogOpen(false);
    setEditingComponent(null);
    resetForm();
  }, [resetForm]);

  const handleUpdateComponent = useCallback(async () => {
    if (!editingComponent || !name.trim() || !description.trim()) {
      showNotification('Name and description are required', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const request: UpdateComponentRequest = {
        componentId: editingComponent.componentId,
        name: name.trim(),
        description: description.trim(),
      };

      await componentsApi.updateComponent(request);
      showNotification('Component updated successfully', 'success');
      handleEditClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update component';
      showNotification(message, 'error');
    } finally {
      setIsUpdating(false);
    }
  }, [editingComponent, name, description, componentsApi, showNotification, handleEditClose, handleRefresh]);

  // Delete component handlers
  const handleDeleteOpen = useCallback((component: Component) => {
    setComponentToDelete(component);
    setDeleteConfirmation('');
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setComponentToDelete(null);
    setDeleteConfirmation('');
  }, []);

  const handleDeleteComponent = useCallback(async () => {
    if (!componentToDelete || deleteConfirmation !== componentToDelete.name) {
      showNotification('Please type the component name to confirm deletion', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await componentsApi.deleteComponent(componentToDelete.componentId);
      showNotification('Component deleted successfully', 'success');
      handleDeleteClose();
      handleRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete component';
      showNotification(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [componentToDelete, deleteConfirmation, componentsApi, showNotification, handleDeleteClose, handleRefresh]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Navigation handler for row clicks
  const handleRowClick = useCallback((_event?: React.MouseEvent, rowData?: Component) => {
    if (!rowData) return;
    // Navigate to runtimes page with projectId and componentId as query parameters
    const params = new URLSearchParams();
    params.set('projectId', rowData.project.projectId);
    params.set('componentId', rowData.componentId);
    navigate(`/runtimes?${params.toString()}`);
  }, [navigate]);

  // Loading and error states
  if (projectsLoading) {
    return <Progress />;
  }

  if (projectsError) {
    return (
      <ResponseErrorPanel
        error={projectsError}
        title="Failed to load projects"
      />
    );
  }

  if (componentsError) {
    return (
      <ResponseErrorPanel
        error={componentsError}
        title="Failed to load components"
      />
    );
  }

  // Table configuration
  const columns: TableColumn<Component>[] = [
    { title: 'Component ID', field: 'componentId' },
    { title: 'Name', field: 'name' },
    { title: 'Description', field: 'description' },
    { title: 'Project', field: 'project.name' },
    { title: 'Created By', field: 'createdBy' },
    {
      title: 'Created At',
      field: 'createdAt',
      render: (data) => {
        const row = data as Component;
        return row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
      },
    },
    { title: 'Updated By', field: 'updatedBy' },
    {
      title: 'Updated At',
      field: 'updatedAt',
      render: (data) => {
        const row = data as Component;
        return row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '';
      },
    },
    {
      title: 'Actions',
      field: 'actions',
      render: (data) => {
        const row = data as Component;
        return (
          <div>
            <IconButton
              onClick={(event) => {
                event.stopPropagation(); // Prevent row click event
                handleEditOpen(row);
              }}
              size="small"
              title="Edit component"
              disabled={isUpdating}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={(event) => {
                event.stopPropagation(); // Prevent row click event
                handleDeleteOpen(row);
              }}
              size="small"
              title="Delete component"
              disabled={isDeleting}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        );
      },
    },
  ];

  const selectedProject = projects?.find(p => p.projectId === selectedProjectId);

  return (
    <>
      <Box mb={2} display="flex" alignItems="right">
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateOpen}
          disabled={isCreating || !selectedProjectId}
        >
          {isCreating ? 'Creating...' : 'Create Component'}
        </Button>
      </Box>
      <Box mb={2}>
        {/* Project Selection Dropdown */}
        <FormControl variant="outlined" style={{ minWidth: 250, marginRight: 16 }}>
          <InputLabel id="project-select-label">Select Project</InputLabel>
          <Select
            labelId="project-select-label"
            value={selectedProjectId}
            onChange={handleProjectChange}
            label="Select Project"
          >
            {projects?.map((project) => (
              <MenuItem key={project.projectId} value={project.projectId}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Create Component Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create Component</DialogTitle>
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
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={isCreating}
          />
          <TextField
            margin="dense"
            label="Project"
            type="text"
            fullWidth
            disabled
            value={selectedProjectId}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateComponent}
            color="primary"
            disabled={!name.trim() || !description.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Component Dialog */}
      <Dialog open={editDialogOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Component</DialogTitle>
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
            onClick={handleUpdateComponent}
            color="primary"
            disabled={!name.trim() || !description.trim() || isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Component Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Component</DialogTitle>
        <DialogContent>
          <p>
            This action cannot be undone. Type the component name{' '}
            <strong>{componentToDelete?.name}</strong> to confirm deletion:
          </p>
          <TextField
            autoFocus
            margin="dense"
            label="Component Name"
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
            onClick={handleDeleteComponent}
            color="primary"
            disabled={deleteConfirmation !== componentToDelete?.name || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Components Table */}
      {componentsLoading ? (
        <Progress />
      ) : (
        <Table
          title={selectedProject ? `Components for Project: ${selectedProject.name}` : 'Components'}
          options={{
            search: true,
            paging: true,
            pageSize: 10,
            emptyRowsWhenPaging: false,
          }}
          columns={columns}
          data={(components || []).map(component => ({
            ...component,
            id: component.componentId, // Add unique ID for table rows
          }))}
          onRowClick={handleRowClick}
        />
      )}

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