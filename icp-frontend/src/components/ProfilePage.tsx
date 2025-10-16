import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Alert,
    Divider,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Stack,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../contexts/AuthContext';
import { icpApiClient } from '../services/ICPApiClient';

const ProfilePage: React.FC = () => {
    const { user, refreshAuth } = useAuth();

    // Dialog states
    const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
    const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);

    // Form states
    const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [profileLoading, setProfileLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const handleOpenEditName = () => {
        setDisplayName(user?.displayName || user?.username || '');
        setProfileSuccess('');
        setProfileError('');
        setEditNameDialogOpen(true);
    };

    const handleCloseEditName = () => {
        setEditNameDialogOpen(false);
        setProfileError('');
    };

    const handleOpenChangePassword = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess('');
        setPasswordError('');
        setChangePasswordDialogOpen(true);
    };

    const handleCloseChangePassword = () => {
        setChangePasswordDialogOpen(false);
        setPasswordError('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileSuccess('');
        setProfileError('');

        if (!displayName.trim()) {
            setProfileError('Display name cannot be empty');
            return;
        }

        setProfileLoading(true);
        try {
            await icpApiClient.updateProfile(displayName.trim());
            setProfileSuccess('Profile updated successfully');
            // Refresh auth to update the user context
            await refreshAuth();
            // Close dialog after short delay to show success message
            setTimeout(() => {
                setEditNameDialogOpen(false);
            }, 1500);
        } catch (error: any) {
            setProfileError(error.message || 'Failed to update profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordSuccess('');
        setPasswordError('');

        // Validate passwords
        if (!currentPassword) {
            setPasswordError('Current password is required');
            return;
        }
        if (!newPassword) {
            setPasswordError('New password is required');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters long');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        setPasswordLoading(true);
        try {
            await icpApiClient.changePassword(currentPassword, newPassword);
            setPasswordSuccess('Password changed successfully');
            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            // Close dialog after short delay to show success message
            setTimeout(() => {
                setChangePasswordDialogOpen(false);
            }, 1500);
        } catch (error: any) {
            setPasswordError(error.message || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
                My Profile
            </Typography>

            {/* Profile Information Card */}
            <Card sx={{ mb: 3, maxWidth: 800 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6">Profile Information</Typography>
                        </Box>
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleOpenEditName}
                            size="small"
                        >
                            Edit Name
                        </Button>
                    </Box>

                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Username
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {user?.username || '-'}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Display Name
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {user?.displayName || user?.username || '-'}
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Roles and Permissions Card */}
            <Card sx={{ mb: 3, maxWidth: 800 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Roles & Permissions</Typography>
                    </Box>

                    <Grid container spacing={3}>
                        {user?.isSuperAdmin && (
                            <Grid item xs={12}>
                                <Chip
                                    label="Super Admin"
                                    color="error"
                                    sx={{ fontWeight: 600 }}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Full access to all resources and settings
                                </Typography>
                            </Grid>
                        )}
                        {user?.isProjectAuthor && (
                            <Grid item xs={12}>
                                <Chip
                                    label="Project Author"
                                    color="secondary"
                                    sx={{ fontWeight: 600 }}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Can create, update, and delete projects
                                </Typography>
                            </Grid>
                        )}
                        <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Project Roles
                            </Typography>
                            {user?.roles && user.roles.length > 0 ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {user.roles.map((role, index) => (
                                        <Chip
                                            key={index}
                                            label={role.roleName}
                                            size="small"
                                            variant="outlined"
                                            color={role.environmentType === 'prod' ? 'error' : 'primary'}
                                            sx={{ mb: 1 }}
                                        />
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No project roles assigned
                                </Typography>
                            )}
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Security Card */}
            <Card sx={{ maxWidth: 800 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LockIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6">Security</Typography>
                        </Box>
                        <Button
                            variant="outlined"
                            startIcon={<LockIcon />}
                            onClick={handleOpenChangePassword}
                            size="small"
                        >
                            Change Password
                        </Button>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        Manage your account security and password settings
                    </Typography>
                </CardContent>
            </Card>

            {/* Edit Display Name Dialog */}
            <Dialog open={editNameDialogOpen} onClose={handleCloseEditName} maxWidth="sm" fullWidth>
                <form onSubmit={handleUpdateProfile}>
                    <DialogTitle>Edit Display Name</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Display Name"
                            type="text"
                            fullWidth
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            sx={{ mt: 2 }}
                        />
                        {profileSuccess && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                {profileSuccess}
                            </Alert>
                        )}
                        {profileError && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {profileError}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseEditName} disabled={profileLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={profileLoading}>
                            {profileLoading ? 'Updating...' : 'Update'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Change Password Dialog */}
            <Dialog open={changePasswordDialogOpen} onClose={handleCloseChangePassword} maxWidth="sm" fullWidth>
                <form onSubmit={handleChangePassword}>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Current Password"
                            type="password"
                            fullWidth
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="New Password"
                            type="password"
                            fullWidth
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            helperText="Must be at least 6 characters long"
                            sx={{ mt: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="Confirm New Password"
                            type="password"
                            fullWidth
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            sx={{ mt: 2 }}
                        />
                        {passwordSuccess && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                {passwordSuccess}
                            </Alert>
                        )}
                        {passwordError && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {passwordError}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseChangePassword} disabled={passwordLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={passwordLoading}>
                            {passwordLoading ? 'Changing...' : 'Change Password'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default ProfilePage;
