import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
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
    useComponents,
    useProjects,
    useCreateComponent,
    useUpdateComponent,
    useDeleteComponent,
} from '../services/hooks';
import {
    Component,
    Project,
    CreateComponentRequest,
    UpdateComponentRequest,
} from '../types';

const ComponentsPage: React.FC = () => {
    const [searchParams] = useSearchParams();

    // Data hooks
    const { loading, error, value: components, retry } = useComponents();
    const { loading: projectsLoading, value: projects } = useProjects();

    // Action hooks
    const { createComponent, loading: creating } = useCreateComponent();
    const { updateComponent, loading: updating } = useUpdateComponent();
    const { deleteComponent, loading: deleting } = useDeleteComponent();

    // State
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error'
    });

    // Form state
    const [newComponent, setNewComponent] = useState<CreateComponentRequest>({
        name: '',
        description: '',
        projectId: '',
    });

    const [editComponent, setEditComponent] = useState<UpdateComponentRequest>({
        componentId: '',
        name: '',
        description: '',
        projectId: '',
    });

    // Filter components based on selected project
    const filteredComponents = useMemo(() => {
        if (!selectedProjectId) {
            return components;
        }
        return components.filter(component => component.project.projectId === selectedProjectId);
    }, [components, selectedProjectId]);

    // Get selected project for display
    const selectedProject = useMemo(() => {
        return projects.find(project => project.projectId === selectedProjectId);
    }, [projects, selectedProjectId]);

    // Effect to handle URL parameters for automatic project selection
    useEffect(() => {
        const projectIdFromUrl = searchParams.get('projectId');
        if (projectIdFromUrl && projects.length > 0) {
            // Check if the project exists in the loaded projects
            const projectExists = projects.some(project => project.projectId === projectIdFromUrl);
            if (projectExists) {
                setSelectedProjectId(projectIdFromUrl);
            }
        }
    }, [searchParams, projects]);

    // Material React Table columns configuration
    const columns = useMemo<MRT_ColumnDef<Component>[]>(
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
                accessorKey: 'project.name',
                header: 'Project',
                enableResizing: true,
                minSize: 120,
                maxSize: 300,
                grow: true,
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
                        <Tooltip title="Edit Component">
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
                        <Tooltip title="Delete Component">
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

    const handleCreateComponent = async () => {
        try {
            await createComponent(newComponent);
            setCreateDialogOpen(false);
            setNewComponent({ name: '', description: '', projectId: selectedProjectId || '' });
            setSnackbar({
                open: true,
                message: 'Component created successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to create component',
                severity: 'error'
            });
        }
    };

    const handleUpdateComponent = async () => {
        try {
            await updateComponent(editComponent);
            setEditDialogOpen(false);
            setSnackbar({
                open: true,
                message: 'Component updated successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to update component',
                severity: 'error'
            });
        }
    };

    const handleEditClick = (component: Component) => {
        setEditComponent({
            componentId: component.componentId,
            name: component.name,
            description: component.description,
            projectId: component.project.projectId,
        });
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (component: Component) => {
        setComponentToDelete(component);
        setDeleteDialogOpen(true);
        setDeleteConfirmation('');
    };

    const handleDeleteConfirm = async () => {
        if (componentToDelete && deleteConfirmation === componentToDelete.name) {
            try {
                await deleteComponent(componentToDelete.componentId);
                setDeleteDialogOpen(false);
                setComponentToDelete(null);
                setDeleteConfirmation('');
                setSnackbar({
                    open: true,
                    message: 'Component deleted successfully',
                    severity: 'success'
                });
                retry();
            } catch (err) {
                setSnackbar({
                    open: true,
                    message: 'Failed to delete component',
                    severity: 'error'
                });
            }
        }
    };

    // Material React Table configuration
    const tableConfig = {
        columns,
        data: filteredComponents,
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
                    onClick={() => {
                        setNewComponent({
                            name: '',
                            description: '',
                            projectId: selectedProjectId || ''
                        });
                        setCreateDialogOpen(true);
                    }}
                >
                    Add Component
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
        state: {
            isLoading: loading,
        },
    };

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Components
                </Typography>
                <Alert severity="error">
                    Error loading components: {error.message}
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
                Components ({filteredComponents.length})
            </Typography>

            {/* Project Selection */}
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl sx={{ minWidth: 300 }}>
                        <InputLabel>Filter by Project</InputLabel>
                        <Select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            label="Filter by Project"
                            disabled={projectsLoading}
                        >
                            <MenuItem value="">
                                <em>All Projects</em>
                            </MenuItem>
                            {projects.map((project) => (
                                <MenuItem key={project.projectId} value={project.projectId}>
                                    {project.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedProject && (
                        <Box>
                            <Typography variant="h6">
                                {selectedProject.name}
                            </Typography>
                            {selectedProject.description && (
                                <Typography variant="body2" color="text.secondary">
                                    {selectedProject.description}
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Paper>

            <MaterialReactTable {...tableConfig} />

            {/* Create Component Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create New Component</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={newComponent.name}
                        onChange={(e) => setNewComponent({
                            ...newComponent,
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
                        value={newComponent.description}
                        onChange={(e) => setNewComponent({
                            ...newComponent,
                            description: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth variant="outlined">
                        <InputLabel>Project</InputLabel>
                        <Select
                            value={newComponent.projectId}
                            onChange={(e) => setNewComponent({
                                ...newComponent,
                                projectId: e.target.value
                            })}
                            label="Project"
                            disabled={projectsLoading}
                        >
                            {projects.map((project) => (
                                <MenuItem key={project.projectId} value={project.projectId}>
                                    {project.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateComponent}
                        variant="contained"
                        disabled={creating || !newComponent.name.trim() || !newComponent.projectId}
                    >
                        {creating ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Component Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Edit Component</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={editComponent.name}
                        onChange={(e) => setEditComponent({
                            ...editComponent,
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
                        value={editComponent.description}
                        onChange={(e) => setEditComponent({
                            ...editComponent,
                            description: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth variant="outlined">
                        <InputLabel>Project</InputLabel>
                        <Select
                            value={editComponent.projectId}
                            onChange={(e) => setEditComponent({
                                ...editComponent,
                                projectId: e.target.value
                            })}
                            label="Project"
                            disabled={projectsLoading}
                        >
                            {projects.map((project) => (
                                <MenuItem key={project.projectId} value={project.projectId}>
                                    {project.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateComponent}
                        variant="contained"
                        disabled={updating || !editComponent.name.trim() || !editComponent.projectId}
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
                <DialogTitle>Delete Component</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Are you sure you want to delete the component "{componentToDelete?.name}"?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        This action cannot be undone.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        Type the component name to confirm:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" gutterBottom>
                        {componentToDelete?.name}
                    </Typography>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Enter component name"
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
                            deleteConfirmation !== componentToDelete?.name
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

export default ComponentsPage;