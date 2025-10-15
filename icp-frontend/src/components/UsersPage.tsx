import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    DialogContentText,
    InputAdornment,
    Stack,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Divider,
    Snackbar,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRoles, useProjects, useEnvironments } from '../services/hooks';
import { UserWithRoles, CreateUserRequest, Project, Environment, Role } from '../types';

interface RoleAssignment {
    projectId: string;
    environmentId: string;
    privilegeLevel: 'admin' | 'developer' | 'none';
}

const UsersPage: React.FC = () => {
    const { value: users, loading, error, retry } = useUsers();
    const { createUser, loading: creating } = useCreateUser();
    const { deleteUser, loading: deleting } = useDeleteUser();
    const { updateUserRoles, loading: updatingRoles } = useUpdateUserRoles();
    const { value: projects, loading: loadingProjects } = useProjects();
    const { value: environments, loading: loadingEnvironments } = useEnvironments();

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editPermissionsOpen, setEditPermissionsOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });

    const [formData, setFormData] = useState<CreateUserRequest>({
        username: '',
        displayName: '',
        password: '',
    });

    const [formErrors, setFormErrors] = useState<{
        username?: string;
        displayName?: string;
        password?: string;
    }>({});

    const handleAddUser = () => {
        setFormData({ username: '', displayName: '', password: '' });
        setFormErrors({});
        setAddDialogOpen(true);
    };

    const handleCloseAddDialog = () => {
        setAddDialogOpen(false);
        setFormData({ username: '', displayName: '', password: '' });
        setFormErrors({});
        setShowPassword(false);
    };

    const validateForm = (): boolean => {
        const errors: typeof formErrors = {};

        if (!formData.username.trim()) {
            errors.username = 'Username is required';
        }
        if (!formData.displayName.trim()) {
            errors.displayName = 'Display name is required';
        }
        if (!formData.password.trim()) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitUser = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            await createUser(formData);
            handleCloseAddDialog();
            retry();
        } catch (error) {
            console.error('Error creating user:', error);
        }
    };

    const handleDeleteClick = (user: UserWithRoles) => {
        setSelectedUser(user);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedUser) return;

        try {
            await deleteUser(selectedUser.userId);
            setDeleteDialogOpen(false);
            setSelectedUser(null);
            retry();
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setSelectedUser(null);
    };

    const handleEditPermissions = (user: UserWithRoles) => {
        setSelectedUser(user);
        setEditPermissionsOpen(true);
        
        // Initialize role assignments from user's current roles
        const assignments: RoleAssignment[] = [];
        
        // Create a map of existing roles for quick lookup
        const existingRoles = new Map<string, Role>();
        user.roles.forEach(role => {
            const key = `${role.projectId}-${role.environmentId}`;
            existingRoles.set(key, role);
        });
        
        // For each project-environment combination, set the privilege level
        projects.forEach(project => {
            environments.forEach(environment => {
                const key = `${project.projectId}-${environment.environmentId}`;
                const existingRole = existingRoles.get(key);
                
                assignments.push({
                    projectId: project.projectId,
                    environmentId: environment.environmentId,
                    privilegeLevel: existingRole ? existingRole.privilegeLevel as 'admin' | 'developer' : 'none',
                });
            });
        });
        
        setRoleAssignments(assignments);
    };

    const handleCloseEditPermissions = () => {
        setEditPermissionsOpen(false);
        setSelectedUser(null);
        setRoleAssignments([]);
    };

    const handleRoleChange = (projectId: string, environmentId: string, privilegeLevel: 'admin' | 'developer' | 'none') => {
        setRoleAssignments(prev => 
            prev.map(assignment => 
                assignment.projectId === projectId && assignment.environmentId === environmentId
                    ? { ...assignment, privilegeLevel }
                    : assignment
            )
        );
    };

    const handleSavePermissions = async () => {
        if (!selectedUser) return;
        
        try {
            // Filter out "none" assignments and format for API
            const rolesToSave = roleAssignments
                .filter(r => r.privilegeLevel !== 'none')
                .map(r => ({
                    projectId: r.projectId,
                    environmentId: r.environmentId,
                    privilegeLevel: r.privilegeLevel,
                }));
            
            console.log('Saving permissions for user:', selectedUser.userId);
            console.log('Role assignments:', rolesToSave);
            
            await updateUserRoles(selectedUser.userId, rolesToSave);
            
            // Show success message
            setSnackbar({
                open: true,
                message: `Permissions updated successfully for ${selectedUser.displayName}`,
                severity: 'success',
            });
            
            // Refresh the users list to show updated roles
            retry();
            
            handleCloseEditPermissions();
        } catch (error) {
            console.error('Error saving permissions:', error);
            setSnackbar({
                open: true,
                message: `Failed to update permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: 'error',
            });
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Error loading users: {error.message}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Users
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddUser}
                >
                    Add New User
                </Button>
            </Box>

            {users.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="textSecondary">
                        No users found. Click "Add New User" to create one.
                    </Typography>
                </Paper>
            ) : (
                users.map((user) => (
                    <Accordion key={user.userId} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
                                <PersonIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6">{user.displayName}</Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        @{user.username}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<EditIcon />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditPermissions(user);
                                        }}
                                        disabled={loadingProjects || loadingEnvironments}
                                    >
                                        Edit Permissions
                                    </Button>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(user);
                                        }}
                                        disabled={deleting}
                                        title="Delete User"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    User Details:
                                </Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    User ID: {user.userId}
                                </Typography>
                                {user.createdAt && (
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Created: {new Date(user.createdAt).toLocaleString()}
                                    </Typography>
                                )}

                                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                                    Roles ({user.roles.length}):
                                </Typography>
                                {user.roles.length === 0 ? (
                                    <Typography variant="body2" color="textSecondary">
                                        No roles assigned
                                    </Typography>
                                ) : (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {user.roles.map((role) => (
                                            <Chip
                                                key={role.roleId}
                                                label={role.roleName}
                                                size="small"
                                                color={role.privilegeLevel === 'admin' ? 'error' : 'primary'}
                                                variant="outlined"
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                ))
            )}

            {/* Add User Dialog */}
            <Dialog open={addDialogOpen} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Add New User</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                        <TextField
                            label="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            error={!!formErrors.username}
                            helperText={formErrors.username}
                            fullWidth
                            required
                            autoFocus
                        />
                        <TextField
                            label="Display Name"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            error={!!formErrors.displayName}
                            helperText={formErrors.displayName}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            error={!!formErrors.password}
                            helperText={formErrors.password}
                            fullWidth
                            required
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseAddDialog} disabled={creating}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmitUser}
                        variant="contained"
                        color="primary"
                        disabled={creating}
                    >
                        {creating ? <CircularProgress size={24} /> : 'Create User'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
                <DialogTitle>Delete User</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete user "{selectedUser?.displayName}" (@{selectedUser?.username})?
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        disabled={deleting}
                    >
                        {deleting ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Permissions Dialog */}
            <Dialog 
                open={editPermissionsOpen} 
                onClose={handleCloseEditPermissions}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Edit Permissions - {selectedUser?.displayName}
                </DialogTitle>
                <DialogContent>
                    {loadingProjects || loadingEnvironments ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
                                Assign roles for each project-environment combination. Select "No Access" to remove permissions.
                            </Typography>
                            
                            {projects.length === 0 || environments.length === 0 ? (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    {projects.length === 0 ? 'No projects available. ' : ''}
                                    {environments.length === 0 ? 'No environments available. ' : ''}
                                    Please create projects and environments first.
                                </Alert>
                            ) : (
                                projects.map((project) => (
                                    <Accordion key={project.projectId} sx={{ mb: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Typography variant="h6" sx={{ color: 'primary.main' }}>
                                                        {project.name}
                                                    </Typography>
                                                    {project.description && (
                                                        <Typography variant="body2" color="textSecondary">
                                                            {project.description}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Stack spacing={2}>
                                                {environments.map(environment => {
                                                    const assignment = roleAssignments.find(
                                                        a => a.projectId === project.projectId && 
                                                             a.environmentId === environment.environmentId
                                                    );
                                                    
                                                    return (
                                                        <Paper 
                                                            key={environment.environmentId} 
                                                            variant="outlined" 
                                                            sx={{ p: 2 }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                                <Box sx={{ flex: 1 }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Typography variant="subtitle1">
                                                                            {environment.name}
                                                                        </Typography>
                                                                        <Chip 
                                                                            label={environment.isProduction ? 'Production' : 'Non-Production'}
                                                                            size="small" 
                                                                            color={environment.isProduction ? 'error' : 'primary'}
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                    {environment.description && (
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            {environment.description}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                                <FormControl component="fieldset">
                                                                    <RadioGroup
                                                                        row
                                                                        value={assignment?.privilegeLevel || 'none'}
                                                                        onChange={(e) => handleRoleChange(
                                                                            project.projectId,
                                                                            environment.environmentId,
                                                                            e.target.value as 'admin' | 'developer' | 'none'
                                                                        )}
                                                                    >
                                                                        <FormControlLabel 
                                                                            value="none" 
                                                                            control={<Radio size="small" />} 
                                                                            label="No Access" 
                                                                        />
                                                                        <FormControlLabel 
                                                                            value="developer" 
                                                                            control={<Radio size="small" />} 
                                                                            label="Developer" 
                                                                        />
                                                                        <FormControlLabel 
                                                                            value="admin" 
                                                                            control={<Radio size="small" />} 
                                                                            label="Admin" 
                                                                        />
                                                                    </RadioGroup>
                                                                </FormControl>
                                                            </Box>
                                                        </Paper>
                                                    );
                                                })}
                                            </Stack>
                                        </AccordionDetails>
                                    </Accordion>
                                ))
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEditPermissions} disabled={updatingRoles}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSavePermissions}
                        variant="contained"
                        color="primary"
                        disabled={loadingProjects || loadingEnvironments || projects.length === 0 || environments.length === 0 || updatingRoles}
                    >
                        {updatingRoles ? <CircularProgress size={24} /> : 'Save Permissions'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Success/Error Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default UsersPage;

