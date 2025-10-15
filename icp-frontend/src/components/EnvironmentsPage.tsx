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
    FormControlLabel,
    Switch,
    Chip,
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
    useEnvironments,
    useCreateEnvironment,
    useUpdateEnvironment,
    useDeleteEnvironment,
} from '../services/hooks';
import {
    Environment,
    CreateEnvironmentRequest,
    UpdateEnvironmentRequest,
} from '../types';
import { useAuth } from '../contexts/AuthContext';

const EnvironmentsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // Data hooks
    const { loading, error, value: environments, retry } = useEnvironments();

    // Action hooks
    const { createEnvironment, loading: creating } = useCreateEnvironment();
    const { updateEnvironment, loading: updating } = useUpdateEnvironment();
    const { deleteEnvironment, loading: deleting } = useDeleteEnvironment();

    // State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [environmentToDelete, setEnvironmentToDelete] = useState<Environment | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error'
    });

    // Form state
    const [newEnvironment, setNewEnvironment] = useState<CreateEnvironmentRequest>({
        name: '',
        description: '',
        isProduction: false,
    });

    const [editEnvironment, setEditEnvironment] = useState<UpdateEnvironmentRequest>({
        environmentId: '',
        name: '',
        description: '',
        isProduction: false,
    });

    // Material React Table columns configuration
    const columns = useMemo<MRT_ColumnDef<Environment>[]>(
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
                accessorKey: 'isProduction',
                header: 'Environment Type',
                enableResizing: true,
                minSize: 120,
                maxSize: 180,
                grow: true,
                Cell: ({ cell }) => {
                    const isProduction = cell.getValue<boolean>();
                    return (
                        <Chip
                            label={isProduction ? 'Production' : 'Non-Production'}
                            color={isProduction ? 'error' : 'primary'}
                            variant="outlined"
                            size="small"
                        />
                    );
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
                        {/* Only super admins can edit/delete environments */}
                        {currentUser?.isSuperAdmin ? (
                            <>
                                <Tooltip title="Edit Environment">
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
                                <Tooltip title="Delete Environment">
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
                            </>
                        ) : (
                            <Typography variant="caption" color="text.secondary">
                                View Only
                            </Typography>
                        )}
                    </Box>
                ),
            },
        ],
        []
    );



    const handleCreateEnvironment = async () => {
        try {
            await createEnvironment(newEnvironment);
            setCreateDialogOpen(false);
            setNewEnvironment({ name: '', description: '', isProduction: false });
            setSnackbar({
                open: true,
                message: 'Environment created successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to create environment',
                severity: 'error'
            });
        }
    };

    const handleUpdateEnvironment = async () => {
        try {
            await updateEnvironment(editEnvironment);
            setEditDialogOpen(false);
            setSnackbar({
                open: true,
                message: 'Environment updated successfully',
                severity: 'success'
            });
            retry();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to update environment',
                severity: 'error'
            });
        }
    };

    const handleEditClick = (environment: Environment) => {
        setEditEnvironment({
            environmentId: environment.environmentId,
            name: environment.name,
            description: environment.description,
            isProduction: environment.isProduction,
        });
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (environment: Environment) => {
        setEnvironmentToDelete(environment);
        setDeleteDialogOpen(true);
        setDeleteConfirmation('');
    };

    const handleDeleteConfirm = async () => {
        if (environmentToDelete && deleteConfirmation === environmentToDelete.name) {
            try {
                await deleteEnvironment(environmentToDelete.environmentId);
                setDeleteDialogOpen(false);
                setEnvironmentToDelete(null);
                setDeleteConfirmation('');
                setSnackbar({
                    open: true,
                    message: 'Environment deleted successfully',
                    severity: 'success'
                });
                retry();
            } catch (err) {
                setSnackbar({
                    open: true,
                    message: 'Failed to delete environment',
                    severity: 'error'
                });
            }
        }
    };

    const handleRowClick = (environment: Environment) => {
        // Navigate to environment overview with the selected environment
        navigate(`/environment-overview?environmentId=${environment.environmentId}`);
    };

    // Material React Table configuration
    const tableConfig = {
        columns,
        data: environments,
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
                {/* Only super admins can create environments */}
                {currentUser?.isSuperAdmin && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        Create
                    </Button>
                )}
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
        muiTableBodyRowProps: ({ row }: { row: MRT_Row<Environment> }) => ({
            onClick: () => handleRowClick(row.original),
            sx: {
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
            },
        }),
    };

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Environments
                </Typography>
                <Alert severity="error">
                    Error loading environments: {error.message}
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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" gutterBottom>
                    Environments
                </Typography>
                <Chip
                    label={`${environments.length}`}
                    color="primary"
                    variant="outlined"
                />
            </Box>


            <MaterialReactTable {...tableConfig} />

            {/* Create Environment Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create New Environment</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={newEnvironment.name}
                        onChange={(e) => setNewEnvironment({
                            ...newEnvironment,
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
                        value={newEnvironment.description}
                        onChange={(e) => setNewEnvironment({
                            ...newEnvironment,
                            description: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={newEnvironment.isProduction}
                                onChange={(e) => setNewEnvironment({
                                    ...newEnvironment,
                                    isProduction: e.target.checked
                                })}
                                color="primary"
                            />
                        }
                        label="Production Environment"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateEnvironment}
                        variant="contained"
                        disabled={creating || !newEnvironment.name.trim()}
                    >
                        {creating ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Environment Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Edit Environment</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={editEnvironment.name}
                        onChange={(e) => setEditEnvironment({
                            ...editEnvironment,
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
                        value={editEnvironment.description}
                        onChange={(e) => setEditEnvironment({
                            ...editEnvironment,
                            description: e.target.value
                        })}
                        sx={{ mb: 2 }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={editEnvironment.isProduction}
                                onChange={(e) => setEditEnvironment({
                                    ...editEnvironment,
                                    isProduction: e.target.checked
                                })}
                                color="primary"
                            />
                        }
                        label="Production Environment"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateEnvironment}
                        variant="contained"
                        disabled={updating || !editEnvironment.name.trim()}
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
                <DialogTitle>Delete Environment</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Are you sure you want to delete the environment "{environmentToDelete?.name}"?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        This action cannot be undone.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        Type the environment name to confirm:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" gutterBottom>
                        {environmentToDelete?.name}
                    </Typography>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Enter environment name"
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
                            deleteConfirmation !== environmentToDelete?.name
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
        </Box >
    );
};

export default EnvironmentsPage;