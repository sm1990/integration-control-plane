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
    Checkbox,
    Tooltip,
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
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRoles, useAdminProjects, useAdminEnvironments } from '../services/hooks';
import { UserWithRoles, CreateUserRequest, Project, Environment, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RoleAssignment {
    projectId: string;
    environmentId: string;
    privilegeLevel: 'admin' | 'developer' | 'none';
}

const UsersPage: React.FC = () => {
    const { user: currentUser } = useAuth(); // Get current logged-in user to access their roles
    const { value: users, loading, error, retry } = useUsers();
    const { createUser, loading: creating } = useCreateUser();
    const { deleteUser, loading: deleting } = useDeleteUser();
    const { updateUserRoles, loading: updatingRoles } = useUpdateUserRoles();
    
    // Use admin-filtered projects and environments for permission management
    const { value: adminProjects, loading: loadingAdminProjects } = useAdminProjects();
    const { value: allAdminEnvironments, loading: loadingAdminEnvironments } = useAdminEnvironments();
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editPermissionsOpen, setEditPermissionsOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
    const [isProjectAuthorEdit, setIsProjectAuthorEdit] = useState(false);
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
        setIsProjectAuthorEdit(user.isProjectAuthor || false); // Initialize with current value
        setEditPermissionsOpen(true);
        setSelectedProjectId(null); // Reset project selection
        setRoleAssignments([]); // Will be populated when user selects project and environment
    };

    const handleCloseEditPermissions = () => {
        setEditPermissionsOpen(false);
        setSelectedUser(null);
        setRoleAssignments([]);
    };

    const handleRoleChange = (projectId: string, environmentId: string, privilegeLevel: 'admin' | 'developer' | 'none') => {
        setRoleAssignments(prev => {
            // Check if this project-environment combination already exists
            const existingIndex = prev.findIndex(
                a => a.projectId === projectId && a.environmentId === environmentId
            );
            
            if (existingIndex >= 0) {
                // Update existing assignment
                const updated = [...prev];
                updated[existingIndex] = { ...updated[existingIndex], privilegeLevel };
                return updated;
            } else {
                // Add new assignment
                return [...prev, { projectId, environmentId, privilegeLevel }];
            }
        });
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
            console.log('Project author:', isProjectAuthorEdit);
            
            // Prepare request payload with both roles and project author flag
            const payload: any = {
                roles: rolesToSave,
            };
            
            // Only include isProjectAuthor if current user is super admin
            // (only super admins can update this flag)
            if (currentUser?.isSuperAdmin) {
                payload.isProjectAuthor = isProjectAuthorEdit;
            }
            
            await updateUserRoles(selectedUser.userId, payload);
            
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
                {/* Only super admins can create users */}
                {currentUser?.isSuperAdmin && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleAddUser}
                    >
                        Add New User
                    </Button>
                )}
            </Box>

            {users.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    {currentUser?.isSuperAdmin ? (
                        <Typography color="textSecondary">
                            No users found. Click "Add New User" to create one.
                        </Typography>
                    ) : (
                        <Typography color="textSecondary">
                            You do not have admin access to any projects. Only admins can view and manage users in their projects.
                        </Typography>
                    )}
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
                                    {/* Only super admins can edit super admin permissions */}
                                    {(user.isSuperAdmin && !currentUser?.isSuperAdmin) ? (
                                        <Tooltip title="Only super admins can edit super admin permissions">
                                            <span>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={<EditIcon />}
                                                    disabled={true}
                                                >
                                                    Edit Permissions
                                                </Button>
                                            </span>
                                        </Tooltip>
                                    ) : (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            startIcon={<EditIcon />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditPermissions(user);
                                            }}
                                            disabled={loadingAdminProjects}
                                        >
                                            Edit Permissions
                                        </Button>
                                    )}
                                    {/* Only super admins can delete users */}
                                    {currentUser?.isSuperAdmin && (
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
                                    )}
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
                                    Roles ({user.roles.length + (user.isSuperAdmin ? 1 : 0) + (user.isProjectAuthor ? 1 : 0)}):
                                </Typography>
                                {!user.isSuperAdmin && !user.isProjectAuthor && user.roles.length === 0 ? (
                                    <Typography variant="body2" color="textSecondary">
                                        No roles assigned
                                    </Typography>
                                ) : (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {/* Show Super Admin badge if user is super admin */}
                                        {user.isSuperAdmin && (
                                            <Chip
                                                label="Super Admin"
                                                size="small"
                                                color="error"
                                                sx={{ 
                                                    fontWeight: 'bold',
                                                    borderWidth: 2
                                                }}
                                            />
                                        )}
                                        {/* Show Project Author badge if user is project author */}
                                        {user.isProjectAuthor && (
                                            <Chip
                                                label="Project Author"
                                                size="small"
                                                color="warning"
                                                sx={{ 
                                                    fontWeight: 'bold',
                                                    borderWidth: 2
                                                }}
                                            />
                                        )}
                                        {/* Show regular project-environment roles */}
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
                    {loadingAdminProjects ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            {/* Project Author checkbox - only visible to super admins */}
                            {currentUser?.isSuperAdmin && (
                                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={isProjectAuthorEdit}
                                                onChange={(e) => setIsProjectAuthorEdit(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                                                    Project Author
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    Can create, update, and delete projects across the system
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </Paper>
                            )}
                            
                            <Divider sx={{ my: 2 }}>
                                <Typography variant="overline" color="textSecondary">
                                    Project & Environment Roles
                                </Typography>
                            </Divider>
                            
                            <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
                                You can only assign roles in projects and environments where you are an admin.
                            </Typography>
                            
                            {adminProjects.length === 0 ? (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    You are not an admin in any projects. You cannot manage user permissions.
                                </Alert>
                            ) : (
                                adminProjects.map((project) => (
                                    <Accordion 
                                        key={project.projectId} 
                                        sx={{ mb: 1 }}
                                        expanded={selectedProjectId === project.projectId}
                                        onChange={(_, isExpanded) => setSelectedProjectId(isExpanded ? project.projectId : null)}
                                    >
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
                                            {(() => {
                                                // Filter environments for this specific project
                                                // Environment type doesn't include projectId, so we need to filter by checking
                                                // if the current user has an admin role for this project+environment combination
                                                const projectEnvironments = allAdminEnvironments.filter(env => {
                                                    // Check if current user has an admin role for this project + this environment
                                                    return currentUser?.roles.some(role =>
                                                        role.projectId === project.projectId &&
                                                        role.environmentId === env.environmentId &&
                                                        role.privilegeLevel === 'admin'
                                                    ) || false;
                                                });

                                                if (loadingAdminEnvironments) {
                                                    return (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                                            <CircularProgress size={24} />
                                                        </Box>
                                                    );
                                                }

                                                if (projectEnvironments.length === 0) {
                                                    return (
                                                        <Alert severity="info">
                                                            You are not an admin in any environments of this project.
                                                        </Alert>
                                                    );
                                                }

                                                return (
                                                    <Stack spacing={2}>
                                                        {projectEnvironments.map(environment => {
                                                        // Find existing role from user's current roles
                                                        const existingRole = selectedUser?.roles.find(
                                                            r => r.projectId === project.projectId && 
                                                                 r.environmentId === environment.environmentId
                                                        );
                                                        
                                                        const assignment = roleAssignments.find(
                                                            a => a.projectId === project.projectId && 
                                                                 a.environmentId === environment.environmentId
                                                        );
                                                        
                                                        const currentPrivilegeLevel = assignment?.privilegeLevel || 
                                                            (existingRole ? existingRole.privilegeLevel as 'admin' | 'developer' : 'none');
                                                        
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
                                                                            value={currentPrivilegeLevel}
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
                                                );
                                            })()}
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
                        disabled={loadingAdminProjects || adminProjects.length === 0 || updatingRoles}
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

