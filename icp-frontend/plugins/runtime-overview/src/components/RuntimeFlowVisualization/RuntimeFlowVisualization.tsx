import React, { useMemo, useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    addEdge,
    Background,
    Controls,
    MarkerType,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { makeStyles } from '@material-ui/core/styles';
import { Typography, Paper } from '@material-ui/core';

import { Runtime } from '../../api/RuntimesApiService';

interface RuntimeFlowVisualizationProps {
    runtimes: Runtime[];
    width?: number;
    height?: number;
}

const useStyles = makeStyles((theme) => ({
    container: {
        width: '100%',
        height: '100%',
        position: 'relative' as const,
    },
    nodeLabel: {
        padding: theme.spacing(1),
        borderRadius: theme.shape.borderRadius,
        fontSize: '12px',
        textAlign: 'center' as const,
        minWidth: '120px',
    },
    projectNode: {
        background: '#e3f2fd',
        border: '2px solid #1976d2',
        color: '#1976d2',
        fontWeight: 700,
    },
    componentNode: {
        background: '#e8f5e8',
        border: '2px solid #4caf50',
        color: '#2e7d32',
        fontWeight: 600,
    },
    runtimeNode: {
        border: '2px solid #333',
        fontWeight: 700,
        color: 'white',
        textAlign: 'left' as const,
    },
    runtimeRunning: {
        background: '#4caf50',
    },
    runtimeOffline: {
        background: '#f44336',
    },
    runtimeError: {
        background: '#f44336',
    },
    runtimeUnknown: {
        background: '#9e9e9e',
    },
}));

// Custom node component for runtime nodes
const RuntimeNode = ({ data }: { data: any }) => {
    const classes = useStyles();

    const getNodeClass = () => {
        const baseClass = `${classes.nodeLabel} ${classes.runtimeNode}`;
        switch (data.state) {
            case 'RUNNING':
                return `${baseClass} ${classes.runtimeRunning}`;
            case 'OFFLINE':
                return `${baseClass} ${classes.runtimeOffline}`;
            case 'ERROR':
                return `${baseClass} ${classes.runtimeError}`;
            default:
                return `${baseClass} ${classes.runtimeUnknown}`;
        }
    };

    return (
        <>
            <Handle type="target" position={Position.Top} isConnectable={false} />
            <Paper className={getNodeClass()}>
                <Typography variant="body2" style={{ color: 'inherit' }}>
                    {data.label}
                </Typography>
                <Typography variant="caption" style={{ color: 'inherit', opacity: 0.8 }}>
                    {data.state}
                </Typography>
                {data.services && (
                    <Typography variant="caption" style={{ color: 'inherit', opacity: 0.8 }} display="block">
                        Services: {data.services}
                    </Typography>
                )}
                {data.listeners && (
                    <Typography variant="caption" style={{ color: 'inherit', opacity: 0.8 }} display="block">
                        Listeners: {data.listeners}
                    </Typography>
                )}
            </Paper>
        </>
    );
};

// Custom node component for project nodes
const ProjectNode = ({ data }: { data: any }) => {
    const classes = useStyles();

    return (
        <>
            <Handle type="source" position={Position.Right} isConnectable={false} />
            <Paper className={`${classes.nodeLabel} ${classes.projectNode}`}>
                <Typography variant="body1">
                    📁 {data.label}
                </Typography>
                <Typography variant="caption">
                    Project
                </Typography>
            </Paper>
        </>
    );
};

// Custom node component for component nodes
const ComponentNode = ({ data }: { data: any }) => {
    const classes = useStyles();

    return (
        <>
            <Handle type="target" position={Position.Left} isConnectable={false} />
            <Handle type="source" position={Position.Bottom} isConnectable={false} />
            <Paper className={`${classes.nodeLabel} ${classes.componentNode}`}>
                <Typography variant="body2">
                    🔧 {data.label}
                </Typography>
                <Typography variant="caption">
                    Component
                </Typography>
            </Paper>
        </>
    );
};

const nodeTypes = {
    project: ProjectNode,
    component: ComponentNode,
    runtime: RuntimeNode,
};

export const RuntimeFlowVisualization: React.FC<RuntimeFlowVisualizationProps> = ({
    runtimes,
}) => {
    const classes = useStyles();

    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        if (!runtimes || !Array.isArray(runtimes) || runtimes.length === 0) {
            return { nodes: [], edges: [] };
        }

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Group runtimes by project and component
        const projectMap = new Map<string, Map<string, Runtime[]>>();

        runtimes.forEach(runtime => {
            const projectName = runtime.component?.project?.name || 'Unknown Project';
            const componentName = runtime.component?.name || 'Unknown Component';

            if (!projectMap.has(projectName)) {
                projectMap.set(projectName, new Map());
            }

            const componentMap = projectMap.get(projectName)!;
            if (!componentMap.has(componentName)) {
                componentMap.set(componentName, []);
            }

            componentMap.get(componentName)!.push(runtime);
        });

        let nodeIndex = 0;
        let yOffset = 50;

        // Create nodes and edges
        projectMap.forEach((componentMap, projectName) => {
            const projectId = `project-${nodeIndex++}`;

            // Add project node
            nodes.push({
                id: projectId,
                type: 'project',
                position: { x: 50, y: yOffset },
                data: {
                    label: projectName || 'Unknown Project',
                    type: 'project'
                },
            });

            let componentXOffset = 300;

            componentMap.forEach((componentRuntimes, componentName) => {
                const componentId = `component-${nodeIndex++}`;

                // Add component node
                nodes.push({
                    id: componentId,
                    type: 'component',
                    position: { x: componentXOffset, y: yOffset },
                    data: {
                        label: componentName || 'Unknown Component',
                        type: 'component'
                    },
                });

                // Add edge from project to component
                edges.push({
                    id: `${projectId}-${componentId}`,
                    source: projectId,
                    target: componentId,
                    type: 'default',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                    },
                });

                const runtimeYOffset = yOffset + 100;

                // Add runtime nodes
                componentRuntimes.forEach((runtime, index) => {
                    const runtimeId = `runtime-${nodeIndex++}`;

                    nodes.push({
                        id: runtimeId,
                        type: 'runtime',
                        position: { x: componentXOffset - 50 + (index * 150), y: runtimeYOffset },
                        data: {
                            label: runtime.runtimeId || 'Unknown Runtime',
                            state: runtime.status || 'unknown',
                            services: runtime.artifacts?.services?.length || 0,
                            listeners: runtime.artifacts?.listeners?.length || 0,
                            type: 'runtime',
                            runtime: runtime
                        },
                    });

                    // Add edge from component to runtime
                    edges.push({
                        id: `${componentId}-${runtimeId}`,
                        source: componentId,
                        target: runtimeId,
                        type: 'default',
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                        },
                    });
                });

                componentXOffset += Math.max(200, runtimes.length * 150);
            });

            yOffset += 250;
        });

        return { nodes, edges };
    }, [runtimes]);

    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    // Since the diagram is now draggable, we need proper change handlers
    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [],
    );

    // Update nodes and edges when initialNodes and initialEdges change
    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges]);

    if (!runtimes || !Array.isArray(runtimes) || runtimes.length === 0) {
        return (
            <div className={classes.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body1" color="textSecondary">
                    No runtime data available
                </Typography>
            </div>
        );
    }

    return (
        <div className={classes.container} style={{ width: '100%', height: '600px' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="top-right"
                defaultEdgeOptions={{
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                    },
                }}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={false}
                edgesFocusable={false}
                nodesFocusable={false}
                draggable={true}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                preventScrolling={false}
            >
                <Background />
                <Controls showInteractive={true} />
            </ReactFlow>
        </div>
    );
};