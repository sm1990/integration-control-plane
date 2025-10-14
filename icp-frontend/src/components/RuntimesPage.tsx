import React, { useState, useMemo } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
    Snackbar,
    Tooltip,
    Grid,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    Divider,
    Card,
    CardContent,
    CardHeader,
} from '@mui/material';
import { Alert } from '@mui/lab';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import {
    MaterialReactTable,
    type MRT_ColumnDef,
    type MRT_Row,
} from 'material-react-table';

import {
    useRuntimes,
    useDeleteRuntime,
} from '../services/hooks';
import {
    Runtime,
} from '../types';

const RuntimesPage: React.FC = () => {
    // Data hooks
    const { loading, error, value: runtimes, retry } = useRuntimes();

    // Action hooks
    const { deleteRuntime, loading: deleting } = useDeleteRuntime();

    // State
    const [selectedRuntime, setSelectedRuntime] = useState<Runtime | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [runtimeToDelete, setRuntimeToDelete] = useState<Runtime | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error'
    });

    // Material React Table columns configuration
    const columns = useMemo<MRT_ColumnDef<Runtime>[]>(
        () => [
            {
                id: 'runtimeId',
                header: 'Runtime ID',
                accessorKey: 'runtimeId',
                enableResizing: true,
                grow: true,
                minSize: 100,
                maxSize: 200,
            },
            {
                id: 'runtimeType',
                header: 'Runtime Type',
                accessorKey: 'runtimeType',
                enableResizing: true,
                grow: true,
                minSize: 100,
                maxSize: 160,
            },
            {
                id: 'lastHeartbeat',
                header: 'Last Heartbeat',
                accessorKey: 'lastHeartbeat',
                enableResizing: true,
                grow: true,
                minSize: 140,
                maxSize: 200,
                Cell: ({ cell }) => {
                    const heartbeat = cell.getValue<string>();
                    if (!heartbeat) return 'N/A';

                    const date = new Date(heartbeat);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));

                    let displayText;
                    if (diffMinutes < 1) {
                        displayText = 'Just now';
                    } else if (diffMinutes < 60) {
                        displayText = `${diffMinutes}m ago`;
                    } else if (diffMinutes < 1440) { // Less than 24 hours
                        const diffHours = Math.floor(diffMinutes / 60);
                        displayText = `${diffHours}h ago`;
                    } else {
                        displayText = date.toLocaleString(); // Shows both date and time
                    }

                    return (
                        <Tooltip title={`Full timestamp: ${date.toLocaleString()}`}>
                            <Typography variant="body2" sx={{ cursor: 'help' }}>
                                {displayText}
                            </Typography>
                        </Tooltip>
                    );
                },
            },
            {
                id: 'status',
                header: 'Status',
                accessorKey: 'status',
                enableResizing: true,
                grow: true,
                minSize: 80,
                maxSize: 130,
                Cell: ({ cell }) => {
                    const status = cell.getValue<string>();
                    const getStatusColor = (status: string) => {
                        switch (status?.toLowerCase()) {
                            case 'active':
                            case 'ready':
                            case 'running':
                                return '#4caf50';
                            case 'pending':
                            case 'offline':
                                return '#f44336';
                            case 'error':
                            case 'failed':
                                return '#f44336';
                            default:
                                return '#9e9e9e';
                        }
                    };

                    return (
                        <Chip
                            label={status || 'Unknown'}
                            size="small"
                            sx={{
                                backgroundColor: getStatusColor(status),
                                color: 'white',
                                fontWeight: 'bold',
                            }}
                        />
                    );
                },
            },
            {
                id: 'environmentId',
                header: 'Environment',
                accessorKey: 'environment.name',
                enableResizing: true,
                grow: true,
                minSize: 100,
                maxSize: 200,
                Cell: ({ cell }) => {
                    const envName = cell.getValue<string>();
                    return envName || 'N/A';
                },
            },
            {
                id: 'project',
                header: 'Project',
                accessorKey: 'component.project.name',
                enableResizing: true,
                grow: true,
                minSize: 120,
                maxSize: 250,
                Cell: ({ cell }) => {
                    const projectName = cell.getValue<string>();
                    return projectName || 'N/A';
                },
            },
            {
                id: 'componentId',
                header: 'Component',
                accessorKey: 'component.name',
                enableResizing: true,
                grow: true,
                minSize: 100,
                maxSize: 200,
                Cell: ({ cell }) => {
                    const componentName = cell.getValue<string>();
                    return componentName || 'N/A';
                },
            },

            {
                id: 'actions',
                header: 'Actions',
                size: 140,
                minSize: 120,
                maxSize: 160,
                enableSorting: false,
                enableColumnFilter: false,
                enableResizing: false,
                Cell: ({ row }) => (
                    <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                        <Tooltip title="View Details">
                            <IconButton
                                color="primary"
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(row.original);
                                }}
                            >
                                <InfoIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Runtime">
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
        [runtimes]
    );

    const handleDeleteClick = (runtime: Runtime) => {
        setRuntimeToDelete(runtime);
        setDeleteDialogOpen(true);
        setDeleteConfirmation('');
    };

    const handleDeleteConfirm = async () => {
        if (runtimeToDelete && deleteConfirmation === runtimeToDelete.runtimeId) {
            try {
                await deleteRuntime(runtimeToDelete.runtimeId);
                setDeleteDialogOpen(false);
                setRuntimeToDelete(null);
                setDeleteConfirmation('');
                setSnackbar({ open: true, message: 'Runtime deleted successfully', severity: 'success' });
                retry();
            } catch (err) {
                setSnackbar({ open: true, message: 'Failed to delete runtime', severity: 'error' });
            }
        }
    };

    const handleRowClick = (runtime: Runtime) => {
        setSelectedRuntime(runtime);
        setDetailsOpen(true);
    };

    // Material React Table configuration
    const tableConfig = {
        columns,
        data: runtimes,
        enableColumnFilters: true,
        enableGlobalFilter: true,
        enableSorting: true,
        enablePagination: true,
        enableColumnResizing: true,
        columnResizeMode: 'onChange' as const,
        layoutMode: 'semantic' as const,
        defaultColumn: {
            enableResizing: true,
            grow: true,
        },
        initialState: {
            pagination: {
                pageSize: 10,
                pageIndex: 0,
            },
            showGlobalFilter: true,
        },
        muiTableBodyRowProps: ({ row }: { row: MRT_Row<Runtime> }) => ({
            onClick: () => handleRowClick(row.original),
            sx: { cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } },
        }),
        renderTopToolbarCustomActions: () => (
            <Box sx={{ display: 'flex', gap: '1rem', p: '0.5rem', alignItems: 'center' }}>
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
                    Runtimes
                </Typography>
                <Alert severity="error">
                    Failed to load runtimes: {error.message}
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
                Runtimes ({runtimes.length})
            </Typography>

            <MaterialReactTable {...tableConfig} />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Delete Runtime</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Are you sure you want to delete the runtime "{runtimeToDelete?.runtimeId}"?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        This action cannot be undone.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        Type the runtime ID to confirm:
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" gutterBottom>
                        {runtimeToDelete?.runtimeId}
                    </Typography>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Enter runtime ID"
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
                            deleteConfirmation !== runtimeToDelete?.runtimeId
                        }
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Runtime Details Dialog */}
            <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { minHeight: '60vh' }
                }}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h5">Runtime Details</Typography>
                        {selectedRuntime && (
                            <Chip
                                label={selectedRuntime.status}
                                size="small"
                                sx={{
                                    backgroundColor: selectedRuntime.status?.toLowerCase() === 'active' ? '#4caf50' :
                                        selectedRuntime.status?.toLowerCase() === 'offline' ? '#f44336' :
                                            selectedRuntime.status?.toLowerCase() === 'error' ? '#f44336' : '#9e9e9e',
                                    color: 'white',
                                    fontWeight: 'bold',
                                }}
                            />
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {selectedRuntime && (
                        <Box sx={{ py: 2 }}>
                            {/* Basic Information */}
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Card elevation={2}>
                                        <CardHeader title="Basic Information" />
                                        <CardContent>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Runtime ID</Typography>
                                                    <Typography variant="body1" fontWeight="medium" sx={{ mb: 2 }}>
                                                        {selectedRuntime.runtimeId}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Type</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.runtimeType}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Version</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.version || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Registration Time</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.registrationTime ?
                                                            new Date(selectedRuntime.registrationTime).toLocaleString() : 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Last Heartbeat</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.lastHeartbeat ?
                                                            new Date(selectedRuntime.lastHeartbeat).toLocaleString() : 'N/A'}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Environment & Component Information */}
                                <Grid item xs={12} md={6}>
                                    <Card elevation={2}>
                                        <CardHeader title="Environment & Component" />
                                        <CardContent>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Environment</Typography>
                                                    <Typography variant="body1" fontWeight="medium" sx={{ mb: 1 }}>
                                                        {selectedRuntime.environment?.name || 'N/A'}
                                                    </Typography>
                                                    {selectedRuntime.environment?.description && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                            {selectedRuntime.environment.description}
                                                        </Typography>
                                                    )}
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Component</Typography>
                                                    <Typography variant="body1" fontWeight="medium" sx={{ mb: 1 }}>
                                                        {selectedRuntime.component?.name || 'N/A'}
                                                    </Typography>
                                                    {selectedRuntime.component?.description && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                            {selectedRuntime.component.description}
                                                        </Typography>
                                                    )}
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Project</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.component?.project?.name || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Platform Information */}
                                <Grid item xs={12} md={6}>
                                    <Card elevation={2}>
                                        <CardHeader title="Platform Information" />
                                        <CardContent>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Platform Name</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.platformName || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Platform Version</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.platformVersion || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Platform Home</Typography>
                                                    <Typography variant="body1" fontWeight="medium" sx={{ wordBreak: 'break-all' }}>
                                                        {selectedRuntime.platformHome || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">OS Name</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.osName || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">OS Version</Typography>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRuntime.osVersion || 'N/A'}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Artifacts Section */}
                                {selectedRuntime.artifacts && (
                                    <Grid item xs={12} md={6}>
                                        <Card elevation={2}>
                                            <CardHeader title="Artifacts" />
                                            <CardContent>
                                                {/* Listeners */}
                                                <Accordion defaultExpanded>
                                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                        <Typography variant="h6">
                                                            Listeners ({selectedRuntime.artifacts.listeners?.length || 0})
                                                        </Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {selectedRuntime.artifacts.listeners && selectedRuntime.artifacts.listeners.length > 0 ? (
                                                            <List dense>
                                                                {selectedRuntime.artifacts.listeners.map((listener, index) => (
                                                                    <React.Fragment key={index}>
                                                                        <ListItem>
                                                                            <ListItemText
                                                                                primary={listener.name}
                                                                                secondary={
                                                                                    <Box>
                                                                                        <Typography variant="body2" component="span">
                                                                                            <strong>Package:</strong> {listener.package}
                                                                                        </Typography>
                                                                                        <br />
                                                                                        <Typography variant="body2" component="span">
                                                                                            <strong>Protocol:</strong> {listener.protocol}
                                                                                        </Typography>
                                                                                        <br />
                                                                                        <Chip
                                                                                            label={listener.state}
                                                                                            size="small"
                                                                                            sx={{ mt: 1 }}
                                                                                            color={
                                                                                                listener.state === 'ENABLED' ? 'success' :
                                                                                                    listener.state === 'DISABLED' ? 'default' :
                                                                                                        listener.state === 'STARTING' ? 'warning' :
                                                                                                            listener.state === 'STOPPING' ? 'warning' : 'error'
                                                                                            }
                                                                                        />
                                                                                    </Box>
                                                                                }
                                                                            />
                                                                        </ListItem>
                                                                        {index < selectedRuntime.artifacts!.listeners!.length - 1 && <Divider />}
                                                                    </React.Fragment>
                                                                ))}
                                                            </List>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                No listeners available
                                                            </Typography>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>

                                                {/* Services */}
                                                <Accordion defaultExpanded sx={{ mt: 2 }}>
                                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                        <Typography variant="h6">
                                                            Services ({selectedRuntime.artifacts.services?.length || 0})
                                                        </Typography>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {selectedRuntime.artifacts.services && selectedRuntime.artifacts.services.length > 0 ? (
                                                            <List dense>
                                                                {selectedRuntime.artifacts.services.map((service, index) => (
                                                                    <React.Fragment key={index}>
                                                                        <ListItem>
                                                                            <ListItemText
                                                                                primary={service.name}
                                                                                secondary={
                                                                                    <Box>
                                                                                        <Typography variant="body2" component="span">
                                                                                            <strong>Package:</strong> {service.package}
                                                                                        </Typography>
                                                                                        <br />
                                                                                        <Typography variant="body2" component="span">
                                                                                            <strong>Base Path:</strong> {service.basePath}
                                                                                        </Typography>
                                                                                        <br />
                                                                                        <Chip
                                                                                            label={service.state}
                                                                                            size="small"
                                                                                            sx={{ mt: 1, mr: 1 }}
                                                                                            color={
                                                                                                service.state === 'ENABLED' ? 'success' :
                                                                                                    service.state === 'DISABLED' ? 'default' :
                                                                                                        service.state === 'STARTING' ? 'warning' :
                                                                                                            service.state === 'STOPPING' ? 'warning' : 'error'
                                                                                            }
                                                                                        />
                                                                                        {service.resources && service.resources.length > 0 && (
                                                                                            <Box sx={{ mt: 2 }}>
                                                                                                <Typography variant="body2" fontWeight="medium">
                                                                                                    Resources ({service.resources.length}):
                                                                                                </Typography>
                                                                                                {service.resources.map((resource, resIndex) => (
                                                                                                    <Box key={resIndex} sx={{ ml: 2, mt: 1 }}>
                                                                                                        <Typography variant="caption" display="block">
                                                                                                            {resource.url}
                                                                                                        </Typography>
                                                                                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                                                            {resource.methods.map((method, methodIndex) => (
                                                                                                                <Chip
                                                                                                                    key={methodIndex}
                                                                                                                    label={method}
                                                                                                                    size="small"
                                                                                                                    variant="outlined"
                                                                                                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                                                                                                />
                                                                                                            ))}
                                                                                                        </Box>
                                                                                                    </Box>
                                                                                                ))}
                                                                                            </Box>
                                                                                        )}
                                                                                    </Box>
                                                                                }
                                                                            />
                                                                        </ListItem>
                                                                        {index < selectedRuntime.artifacts!.services!.length - 1 && <Divider />}
                                                                    </React.Fragment>
                                                                ))}
                                                            </List>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                No services available
                                                            </Typography>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )}
                            </Grid>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)} variant="contained">
                        Close
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

export default RuntimesPage;