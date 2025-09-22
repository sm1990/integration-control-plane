import {
    Table,
    TableColumn,
    Progress,
    ResponseErrorPanel,
} from '@backstage/core-components';
import useAsync from 'react-use/lib/useAsync';
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@material-ui/core';
import { Snackbar, Alert } from '@mui/material';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


type Project = {
    projectId: string;
    name: string;
    description: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
};

export const ProjectsFetchComponent = () => {
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteName, setDeleteName] = useState('');
    const [deleteInput, setDeleteInput] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMsg, setSnackbarMsg] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    const { value, loading, error } = useAsync(async (): Promise<Project[]> => {
        try {
            const response = await fetch('http://localhost:9446/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `query Projects {\n  projects {\n    projectId\n    name\n    description\n    createdBy\n    createdAt\n    updatedAt\n    updatedBy\n  }\n}`,
                }),
            });
            const json = await response.json();
            if (json.errors) {
                setSnackbarMsg('Error fetching projects: ' + json.errors[0].message);
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return [];
            }
            return json.data?.projects || [];
        } catch (err: any) {
            setSnackbarMsg('Network error: ' + err.message);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return [];
        }
    }, [refreshIndex]);

    const navigate = useNavigate();

    const handleProjectRowClick = (project: Project) => {
        navigate(`/icomponents?projectId=${project.projectId}`);
    };

    const handleOpen = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setName('');
        setDescription('');
    };

    const handleCreateProject = async () => {
        try {
            const response = await fetch('http://localhost:9446/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `mutation CreateProject {\n  createProject(project: { name: \"${name}\", description: \"${description}\" }) {\n    projectId\n    name\n    description\n    createdBy\n    createdAt\n    updatedAt\n    updatedBy\n  }\n}`,
                }),
            });
            const json = await response.json();
            if (json.errors) {
                setSnackbarMsg('Error creating project: ' + json.errors[0].message);
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            } else {
                setSnackbarMsg('Project created successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setRefreshIndex(i => i + 1);
                handleClose();
            }
        } catch (err: any) {
            setSnackbarMsg('Network error: ' + err.message);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleEditOpen = (project: Project) => {
        setEditId(project.projectId);
        setEditName(project.name);
        setEditDescription(project.description);
        setEditOpen(true);
    };
    const handleEditClose = () => {
        setEditOpen(false);
        setEditId(null);
        setEditName('');
        setEditDescription('');
    };
    const handleEditProject = async () => {
        try {
            const response = await fetch('http://localhost:9446/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `mutation UpdateProject {\n  updateProject(projectId: \"${editId}\", name: \"${editName}\", description: \"${editDescription}\") {\n    projectId\n    name\n    description\n    createdBy\n    createdAt\n    updatedAt\n    updatedBy\n  }\n}`,
                }),
            });
            const json = await response.json();
            if (json.errors) {
                setSnackbarMsg('Error updating project: ' + json.errors[0].message);
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            } else {
                setSnackbarMsg('Project updated successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setRefreshIndex(i => i + 1);
                handleEditClose();
            }
        } catch (err: any) {
            setSnackbarMsg('Network error: ' + err.message);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleDeleteOpen = (project: Project) => {
        setDeleteId(project.projectId);
        setDeleteName(project.name);
        setDeleteInput('');
        setDeleteOpen(true);
    };
    const handleDeleteClose = () => {
        setDeleteOpen(false);
        setDeleteId(null);
        setDeleteName('');
        setDeleteInput('');
    };
    const handleDeleteProject = async () => {
        try {
            const response = await fetch('http://localhost:9446/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `mutation DeleteProject {\n  deleteProject(projectId: \"${deleteId}\")\n}`,
                }),
            });
            const json = await response.json();
            if (json.errors) {
                setSnackbarMsg('Error deleting project: ' + json.errors[0].message);
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            } else {
                setSnackbarMsg('Project deleted successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setRefreshIndex(i => i + 1);
                handleDeleteClose();
            }
        } catch (err: any) {
            setSnackbarMsg('Network error: ' + err.message);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    if (loading) {
        return <Progress />;
    } else if (error) {
        return <ResponseErrorPanel error={error} />;
    }

    const columns: TableColumn[] = [
        { title: 'Project ID', field: 'projectId' },
        { title: 'Name', field: 'name' },
        { title: 'Description', field: 'description' },
        { title: 'Created By', field: 'createdBy' },
        {
            title: 'Created At',
            field: 'createdAt',
            render: (data) => {
                const row = data as Project;
                return row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
            },
        },
        { title: 'Updated By', field: 'updatedBy' },
        {
            title: 'Updated At',
            field: 'updatedAt',
            render: (data) => {
                const row = data as Project;
                return row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '';
            },
        },
        {
            title: 'Actions',
            field: 'actions',
            render: (data) => {
                const row = data as Project;
                return (
                    <>
                        <IconButton onClick={(e) => {
                            e.stopPropagation();
                            handleEditOpen(row);
                        }}>
                            <EditIcon />
                        </IconButton>
                        <IconButton color="secondary" onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOpen(row);
                        }}>
                            <DeleteIcon />
                        </IconButton>
                    </>
                );
            },
        },
    ];

    const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbarOpen(false);
    };
    return (
        <>
            <Dialog open={editOpen} onClose={handleEditClose}>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        type="text"
                        fullWidth
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        type="text"
                        fullWidth
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleEditClose} color="secondary">Cancel</Button>
                    <Button onClick={handleEditProject} color="primary" disabled={!editName || !editDescription}>Update</Button>
                </DialogActions>
            </Dialog>
            <Button variant="contained" color="primary" onClick={handleOpen} style={{ marginBottom: 16 }}>
                Create Project
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>Create Project</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        type="text"
                        fullWidth
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        type="text"
                        fullWidth
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="secondary">Cancel</Button>
                    <Button onClick={handleCreateProject} color="primary" disabled={!name || !description}>Create</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={deleteOpen} onClose={handleDeleteClose}>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogContent>
                    <p>Type the project name (<b>{deleteName}</b>) to confirm deletion:</p>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Project Name"
                        type="text"
                        fullWidth
                        value={deleteInput}
                        onChange={e => setDeleteInput(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteClose} color="secondary">Cancel</Button>
                    <Button onClick={handleDeleteProject} color="primary" disabled={deleteInput !== deleteName}>Delete</Button>
                </DialogActions>
            </Dialog>
            <Table
                options={{ search: true, paging: true, pageSize: 10, emptyRowsWhenPaging: false }}
                columns={columns}
                data={value || []}
                onRowClick={(_, rowData) => handleProjectRowClick(rowData as Project)}
            />
            <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMsg}
                </Alert>
            </Snackbar>
        </>
    );
};
