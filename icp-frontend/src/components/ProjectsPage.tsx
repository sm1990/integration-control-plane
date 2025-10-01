import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
    Snackbar,
    Tooltip,
} from '@mui/material';
import { Alert } from '@mui/lab';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import {
    MaterialReactTable,
    type MRT_ColumnDef,
    type MRT_Row,
} from 'material-react-table';

import {
    useProjects,
    useCreateProject,
    useUpdateProject,
    useDeleteProject,
} from '../services/hooks';
import {
    Project,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '../types';

const ProjectsPage: React.FC = () => {
    const navigate = useNavigate();

    // Data hooks
    const { loading, error, value: projects, retry } = useProjects();

    // Action hooks
    const { createProject, loading: creating } = useCreateProject();
    const { updateProject, loading: updating } = useUpdateProject();
    const { deleteProject, loading: deleting } = useDeleteProject();

    // State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error'
    });

    // Form state
    const [newProject, setNewProject] = useState<CreateProjectRequest>({
        name: '',
        description: '',
    });

    const [editProject, setEditProject] = useState<UpdateProjectRequest>({
        projectId: '',
        name: '',
        description: '',
    });

    // Material React Table columns configuration
    const columns = useMemo<MRT_ColumnDef<Project>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Name',
                enableResizing: true,
                minSize: 120,
                maxSize: 300,
                grow: true,
            },
            {
                accessorKey: 'description',
                header: 'Description',
                enableResizing: true,
                minSize: 200,
                maxSize: 500,
                grow: true,
                Cell: ({ cell }) => {
                    const desc = cell.getValue<string>();
                    return desc ? (
                        <Tooltip title={desc}>
                            <Typography
                                variant="body2"
                                sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {desc}
                            </Typography>
                        </Tooltip>
                    ) : '-';
                },
            },
            {
                accessorKey: 'createdBy',
                header: 'Created By',
                enableResizing: true,
                minSize: 100,
                maxSize: 200,
                grow: true,
            },
            {
                accessorKey: 'createdAt',
                header: 'Created At',
                enableResizing: true,
                minSize: 140,
                maxSize: 220,
                grow: true,
                Cell: ({ cell }) => {
                    const date = cell.getValue<string>();
                    return date ? new Date(date).toLocaleString() : '-';
                },
            },
            {
                id: 'actions',
                header: 'Actions',
                enableResizing: false,
                size: 120,
                enableSorting: false,
                enableColumnFilter: false,
                Cell: ({ row }) => (
                    <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                        <Tooltip title="Edit Project">
                            <IconButton
                                color="primary"
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(row.original);
                                }}
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Project">
                            <IconButton
                                color="error"
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(row.original);
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ),
            },
        ],
        []
    );

    const handleCreateProject = async () => {
        try {
            await createProject(newProject);
            setCreateDialogOpen(false);
            setNewProject({ name: '', description: '' });
            setSnackbar({
                open: true,
                message: 'Project created successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to create project',
                severity: 'error'
            });
        }
    };

    const handleUpdateProject = async () => {
        try {
            await updateProject(editProject);
            setEditDialogOpen(false);
            setSnackbar({
                open: true,
                message: 'Project updated successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to update project',
                severity: 'error'
            });
        }
    };

    const handleEditClick = (project: Project) => {
        setEditProject({
            projectId: project.projectId,
            name: project.name,
            description: project.description,
        });
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (project: Project) => {
        setProjectToDelete(project);
        setDeleteDialogOpen(true);
        setDeleteConfirmation('');
    };

    const handleDeleteConfirm = async () => {
        if (projectToDelete && deleteConfirmation === projectToDelete.name) {
            try {
                await deleteProject(projectToDelete.projectId);
                setDeleteDialogOpen(false);
                setProjectToDelete(null);
                setDeleteConfirmation('');
                setSnackbar({
                    open: true,
                    message: 'Project deleted successfully',
                    severity: 'success'
                });
                retry();
            } catch (err) {
                setSnackbar({
                    open: true,
                    message: 'Failed to delete project',
                    severity: 'error'
                });
            }
        }
    };

    const handleRowClick = (project: Project) => {
        // Navigate to components page with the project filter
        navigate(`/components?projectId=${project.projectId}`);
    };

    // Material React Table configuration
    const tableConfig = {
        columns,
        data: projects,
        enableColumnFilters: true,
        enableGlobalFilter: true,
        enableSorting: true,
        enablePagination: true,
        enableColumnResizing: true,
        columnResizeMode: 'onChange' as const,
        layoutMode: 'semantic' as const,
        enableColumnVirtualization: false,
        initialState: {
            pagination: {
                pageSize: 10,
                pageIndex: 0,
            },
            showGlobalFilter: true,
            columnSizing: {},
        },
        defaultColumn: {
            minSize: 50,
            maxSize: 1000,
            enableResizing: true,
        },
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', gap: '1rem', p: '0.5rem', alignItems: 'center' }}>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Add Project
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={retry}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>
        ),
        muiTableBodyRowProps: ({ row }: { row: MRT_Row<Project> }) => ({
            onClick: () => handleRowClick(row.original),
            sx: {
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'action.hover'
                }
            },
        }),
        state: {
            isLoading: loading,
        },
    };

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Projects
                </Typography>
                <Alert severity="error">
                    Error loading projects: {error.message}
                </Alert>
                <Button
                    startIcon={<RefreshIcon />}
                    onClick={retry}
                    sx={{ mt: 2 }}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Projects ({projects.length})
            </Typography>

            <MaterialReactTable {...tableConfig} />

            {/* Create Project Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create New Project</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={newProject.name}
                        onChange={(e) => setNewProject({
                            ...newProject,
                            name: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={newProject.description}
                        onChange={(e) => setNewProject({
                            ...newProject,
                            description: e.target.value
                        })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateProject}
                        variant="contained"
                        disabled={creating || !newProject.name.trim()}
                    >
                        {creating ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Project Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Edit Project</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={editProject.name}
                        onChange={(e) => setEditProject({
                            ...editProject,
                            name: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={editProject.description}
                        onChange={(e) => setEditProject({
                            ...editProject,
                            description: e.target.value
                        })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateProject}
                        variant="contained"
                        disabled={updating || !editProject.name.trim()}
                    >
                        {updating ? 'Updating...' : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Delete Project</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Are you sure you want to delete the project "{projectToDelete?.name}"?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        This action cannot be undone. All components within this project will also be affected.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        Type the project name to confirm:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" gutterBottom>
                        {projectToDelete?.name}
                    </Typography>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Enter project name"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={
                            deleting ||
                            deleteConfirmation !== projectToDelete?.name
                        }
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ProjectsPage;