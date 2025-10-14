import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Button,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    CardHeader,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BallerinaIcon from './BallerinaIcon';
import ReactFlow, {
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
    useEnvironments,
    useRuntimes,
    useProjects,
} from '../services/hooks';
import {
    Environment,
    Runtime,
    Project,
} from '../types';

// Function to get the appropriate icon for runtime type
const getRuntimeIcon = (runtimeType: string) => {
    if (runtimeType?.toUpperCase().includes('BI') || runtimeType?.toLowerCase().includes('ballerina')) {
        return <BallerinaIcon sx={{ fontSize: 16, color: '#1976d2' }} />;
    }
    return '🖥️'; // Default computer emoji for other runtime types
};

const EnvironmentOverview: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [selectedRuntime, setSelectedRuntime] = useState<Runtime | null>(null);

    // Data hooks
    const { loading: environmentsLoading, value: environments, retry: retryEnvironments } = useEnvironments();
    const { loading: runtimesLoading, value: allRuntimes, retry: retryRuntimes } = useRuntimes();
    const { loading: projectsLoading, value: projects, retry: retryProjects } = useProjects();

    // Effect to handle URL parameters for automatic environment selection
    useEffect(() => {
        const environmentIdFromUrl = searchParams.get('environmentId');
        if (environmentIdFromUrl && environments.length > 0 && !selectedEnvironmentId) {
            // Only set from URL if no environment is currently selected
            const environmentExists = environments.some(env => env.environmentId === environmentIdFromUrl);
            if (environmentExists) {
                setSelectedEnvironmentId(environmentIdFromUrl);
            }
        }
    }, [searchParams, environments, selectedEnvironmentId]);

    // Reset project selection when environment actually changes (not just during data refresh)
    const prevEnvironmentId = React.useRef<string>('');
    useEffect(() => {
        if (prevEnvironmentId.current !== '' && prevEnvironmentId.current !== selectedEnvironmentId) {
            // Only reset project when environment actually changes, not during initial load or refresh
            setSelectedProjectId('');
        }
        prevEnvironmentId.current = selectedEnvironmentId;
    }, [selectedEnvironmentId]);

    // Filter runtimes by selected environment and project
    const filteredRuntimes = useMemo(() => {
        if (!selectedEnvironmentId) return [];

        let runtimes = allRuntimes.filter(runtime =>
            runtime.environment?.environmentId === selectedEnvironmentId
        );

        // Further filter by project if one is selected
        if (selectedProjectId) {
            runtimes = runtimes.filter(runtime =>
                runtime.component?.project?.projectId === selectedProjectId
            );
        }

        return runtimes;
    }, [allRuntimes, selectedEnvironmentId, selectedProjectId]);

    // Get available projects for the selected environment
    const availableProjects = useMemo(() => {
        if (!selectedEnvironmentId) return [];

        const environmentRuntimes = allRuntimes.filter(runtime =>
            runtime.environment?.environmentId === selectedEnvironmentId
        );

        const projectsSet = new Set<string>();
        const projectsMap = new Map<string, Project>();

        environmentRuntimes.forEach(runtime => {
            const project = runtime.component?.project;
            if (project && !projectsSet.has(project.projectId)) {
                projectsSet.add(project.projectId);
                projectsMap.set(project.projectId, project);
            }
        });

        return Array.from(projectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allRuntimes, selectedEnvironmentId]);

    // Validation: Clear invalid selections after data loads
    useEffect(() => {
        if (!environmentsLoading && selectedEnvironmentId && environments.length > 0) {
            const environmentExists = environments.some(env => env.environmentId === selectedEnvironmentId);
            if (!environmentExists) {
                setSelectedEnvironmentId('');
                setSelectedProjectId(''); // Clear project too if environment is invalid
            }
        }
    }, [environmentsLoading, selectedEnvironmentId, environments]);

    useEffect(() => {
        if (!runtimesLoading && selectedProjectId && availableProjects.length > 0) {
            const projectExists = availableProjects.some(proj => proj.projectId === selectedProjectId);
            if (!projectExists) {
                setSelectedProjectId('');
            }
        }
    }, [runtimesLoading, selectedProjectId, availableProjects]);

    // Create nodes and edges for React Flow
    const { nodes, edges } = useMemo(() => {
        if (!filteredRuntimes.length) {
            return { nodes: [], edges: [] };
        }

        // Group runtimes by project and component
        const projectGroups: { [key: string]: { [key: string]: Runtime[] } } = {};

        filteredRuntimes.forEach(runtime => {
            const projectName = runtime.component?.project?.name || 'Unknown Project';
            const componentName = runtime.component?.name || 'Unknown Component';

            if (!projectGroups[projectName]) {
                projectGroups[projectName] = {};
            }
            if (!projectGroups[projectName][componentName]) {
                projectGroups[projectName][componentName] = [];
            }
            projectGroups[projectName][componentName].push(runtime);
        });

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        let xOffset = 0;
        const projectSpacing = 250;
        const componentSpacing = 150;
        const runtimeSpacing = 200;

        Object.entries(projectGroups).forEach(([projectName, components], projectIndex) => {
            // Create project node
            const projectNodeId = `project-${projectIndex}`;
            nodes.push({
                id: projectNodeId,
                type: 'default',
                position: { x: xOffset, y: 50 },
                data: {
                    label: (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" fontWeight="bold">
                                📁 {projectName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                [Project]
                            </Typography>
                        </Box>
                    )
                },
                style: {
                    background: '#e3f2fd',
                    border: '2px solid #1976d2',
                    borderRadius: '10px',
                    width: 180,
                    height: 80,
                },
                sourcePosition: Position.Bottom,
                targetPosition: Position.Top,
            });

            let componentXOffset = xOffset;

            Object.entries(components).forEach(([componentName, runtimes], componentIndex) => {
                // Create component node
                const componentNodeId = `component-${projectIndex}-${componentIndex}`;
                const componentY = 200;

                nodes.push({
                    id: componentNodeId,
                    type: 'default',
                    position: { x: componentXOffset, y: componentY },
                    data: {
                        label: (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="subtitle1" fontWeight="medium">
                                    🧩 {componentName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    [Component]
                                </Typography>
                            </Box>
                        )
                    },
                    style: {
                        background: '#e5edf5ff',
                        border: '2px solid #2742b0ff',
                        borderRadius: '8px',
                        width: 160,
                        height: 70,
                    },
                    sourcePosition: Position.Bottom,
                    targetPosition: Position.Top,
                });

                // Create edge from project to component
                edges.push({
                    id: `edge-${projectNodeId}-${componentNodeId}`,
                    source: projectNodeId,
                    target: componentNodeId,
                    style: { stroke: '#1976d2', strokeWidth: 2 },
                    type: 'smoothstep',
                });

                // Create runtime nodes
                runtimes.forEach((runtime, runtimeIndex) => {
                    const runtimeNodeId = `runtime-${projectIndex}-${componentIndex}-${runtimeIndex}`;
                    const runtimeY = 350;
                    const runtimeX = componentXOffset + (runtimeIndex * 180) - (runtimes.length - 1) * 90;

                    const getStatusColor = (status: string) => {
                        switch (status?.toLowerCase()) {
                            case 'active':
                            case 'ready':
                            case 'running':
                                return { bg: '#e8f5e8', border: '#4caf50' };
                            case 'creating':
                                return { bg: '#fff3e0', border: '#ff9800' };
                            case 'offline':
                            case 'failed':
                                return { bg: '#ffebee', border: '#f44336' };
                            default:
                                return { bg: '#f5f5f5', border: '#9e9e9e' };
                        }
                    };

                    const statusColor = getStatusColor(runtime.status);

                    nodes.push({
                        id: runtimeNodeId,
                        type: 'default',
                        position: { x: runtimeX, y: runtimeY },
                        data: {
                            label: (
                                <Box sx={{ textAlign: 'center', p: 1, position: 'relative' }}>
                                    <Typography variant="caption" fontWeight="medium" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {getRuntimeIcon(runtime.runtimeType)} {runtime.runtimeId}
                                    </Typography>
                                    <Chip
                                        label={runtime.status}
                                        size="small"
                                        sx={{
                                            fontSize: '0.7rem',
                                            height: 15,
                                            backgroundColor: statusColor.border,
                                            color: 'white'
                                        }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewRuntime(runtime);
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            bottom: 2,
                                            right: 1,
                                            width: 20,
                                            height: 20,
                                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(255, 255, 255, 1)',
                                            }
                                        }}
                                    >
                                        <VisibilityIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                </Box>
                            )
                        },
                        style: {
                            background: statusColor.bg,
                            border: `2px solid ${statusColor.border}`,
                            borderRadius: '6px',
                            width: 140,
                            height: 80,
                        },
                        targetPosition: Position.Top,
                    });

                    // Create edge from component to runtime
                    edges.push({
                        id: `edge-${componentNodeId}-${runtimeNodeId}`,
                        source: componentNodeId,
                        target: runtimeNodeId,
                        style: { stroke: '#2777b0ff', strokeWidth: 2 },
                        type: 'smoothstep',
                    });
                });

                componentXOffset += Math.max(runtimes.length * 180, 180) + 40;
            });

            xOffset = componentXOffset + projectSpacing;
        });

        return { nodes, edges };
    }, [filteredRuntimes]);

    const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
    const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

    // Update React Flow when data changes
    React.useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [nodes, edges, setNodes, setEdges]);

    const handleRefresh = useCallback(() => {
        retryEnvironments();
        retryRuntimes();
        retryProjects();
    }, [retryEnvironments, retryRuntimes, retryProjects]);

    // Dialog handlers
    const handleViewRuntime = useCallback((runtime: Runtime) => {
        setSelectedRuntime(runtime);
        setDialogOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setDialogOpen(false);
        setSelectedRuntime(null);
    }, []);

    // Prevent deletion of nodes and edges
    const onNodesDelete = useCallback(() => {
        // Do nothing to prevent deletion
    }, []);

    const onEdgesDelete = useCallback(() => {
        // Do nothing to prevent deletion
    }, []);

    const selectedEnvironment = environments.find(env => env.environmentId === selectedEnvironmentId);
    const selectedProject = projects.find(project => project.projectId === selectedProjectId);

    const isLoading = environmentsLoading || runtimesLoading || projectsLoading;

    return (
        <Box sx={{ p: 3, height: 'calc(100vh - 100px)' }}>
            <Typography variant="h4" gutterBottom>
                Environment Overview
            </Typography>

            {/* Environment and Project Selection */}
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 300 }}>
                        <InputLabel>Select Environment</InputLabel>
                        <Select
                            value={selectedEnvironmentId}
                            onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                            label="Select Environment"
                            disabled={environmentsLoading}
                            displayEmpty
                        >
                            {/* Show current selection even when data is loading */}
                            {environmentsLoading && selectedEnvironmentId && !environments.some(env => env.environmentId === selectedEnvironmentId) && (
                                <MenuItem value={selectedEnvironmentId} disabled>
                                    Loading...
                                </MenuItem>
                            )}
                            {environments.map((environment) => (
                                <MenuItem key={environment.environmentId} value={environment.environmentId}>
                                    {environment.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {selectedEnvironmentId && (availableProjects.length > 0 || runtimesLoading) && (
                        <FormControl sx={{ minWidth: 250 }}>
                            <InputLabel shrink>Project Filter</InputLabel>
                            <Select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                label="Project Filter"
                                disabled={isLoading}
                                displayEmpty
                                notched
                            >
                                <MenuItem value="">
                                    <em>All Projects</em>
                                </MenuItem>
                                {/* Show current project selection even when data is loading */}
                                {runtimesLoading && selectedProjectId && !availableProjects.some(proj => proj.projectId === selectedProjectId) && (
                                    <MenuItem value={selectedProjectId} disabled>
                                        Loading...
                                    </MenuItem>
                                )}
                                {availableProjects.map((project) => (
                                    <MenuItem key={project.projectId} value={project.projectId}>
                                        📁 {project.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Tooltip title="Refresh data">
                        <IconButton
                            onClick={handleRefresh}
                            disabled={isLoading}
                            color="primary"
                            size="large"
                            sx={{
                                border: '1px solid',
                                borderColor: 'primary.main',
                                '&:hover': {
                                    backgroundColor: 'primary.light',
                                    color: 'primary.contrastText'
                                }
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {selectedEnvironment && (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <Typography variant="h6">
                                {selectedEnvironment.name}
                            </Typography>
                            <Chip
                                label={selectedEnvironment.isProduction ? 'Production' : 'Non-Production'}
                                color={selectedEnvironment.isProduction ? 'error' : 'primary'}
                                variant="outlined"
                                size="small"
                            />
                            {selectedProject && (
                                <Chip
                                    label={`Project: ${selectedProject.name}`}
                                    color="secondary"
                                    variant="outlined"
                                    size="small"
                                />
                            )}
                        </Box>
                        {selectedEnvironment.description && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {selectedEnvironment.description}
                            </Typography>
                        )}
                        {selectedProject && selectedProject.description && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                <strong>Project:</strong> {selectedProject.description}
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="body2">
                                <strong>Runtimes:</strong> {filteredRuntimes.length}
                            </Typography>
                            {selectedProjectId && availableProjects.length > 1 && (
                                <Typography variant="body2">
                                    <strong>Total Projects:</strong> {availableProjects.length}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* React Flow Visualization */}
            {selectedEnvironmentId && (
                <Card sx={{ height: 'calc(100vh - 350px)', minHeight: 400 }}>
                    <CardContent sx={{ height: '100%', p: 0 }}>
                        {isLoading ? (
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%'
                            }}>
                                <CircularProgress />
                            </Box>
                        ) : filteredRuntimes.length === 0 ? (
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                                flexDirection: 'column'
                            }}>
                                <Typography variant="h6" color="text.secondary">
                                    {selectedProjectId
                                        ? `No runtimes found for project "${selectedProject?.name}" in this environment`
                                        : 'No runtimes found in this environment'
                                    }
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {selectedProjectId
                                        ? 'Try selecting a different project or environment.'
                                        : 'Try selecting a different environment or check if runtimes are deployed.'
                                    }
                                </Typography>
                            </Box>
                        ) : (
                            <ReactFlow
                                nodes={reactFlowNodes}
                                edges={reactFlowEdges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onNodesDelete={onNodesDelete}
                                onEdgesDelete={onEdgesDelete}
                                fitView
                                fitViewOptions={{ padding: 0.2 }}
                                nodesDraggable={true}
                                nodesConnectable={false}
                                elementsSelectable={true}
                                selectNodesOnDrag={false}
                                panOnDrag={true}
                                zoomOnScroll={true}
                                zoomOnPinch={true}
                                zoomOnDoubleClick={true}
                                preventScrolling={false}
                            >
                                <Controls />
                                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                            </ReactFlow>
                        )}
                    </CardContent>
                </Card>
            )}

            {!selectedEnvironmentId && (
                <Card sx={{ height: 'calc(100vh - 350px)', minHeight: 400 }}>
                    <CardContent>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            flexDirection: 'column'
                        }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Select an environment to view runtime visualization
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Choose an environment from the dropdown above to see the runtime topology.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                You can optionally filter by a specific project to focus on that project's diagram.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Runtime Details Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
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
                                        selectedRuntime.status?.toLowerCase() === 'offline' ? '#ff9800' :
                                            selectedRuntime.status?.toLowerCase() === 'error' ? '#f44336' : '#9e9e9e',
                                    color: 'white',
                                    fontWeight: 'bold',
                                }}
                            />
                        )}
                        <IconButton onClick={handleCloseDialog} size="small" sx={{ ml: 'auto' }}>
                            <CloseIcon />
                        </IconButton>
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
                    <Button onClick={handleCloseDialog} variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EnvironmentOverview;