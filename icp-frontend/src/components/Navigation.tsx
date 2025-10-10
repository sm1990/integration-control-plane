import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Divider,
    IconButton,
    Box,
} from '@mui/material';
import {
    Dashboard as RuntimesIcon,
    CloudQueue as EnvironmentsIcon,
    Extension as ComponentsIcon,
    Folder as ProjectsIcon,
    Home as HomeIcon,
    Visibility as OverviewIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

interface NavigationProps {
    open: boolean;
    onToggle: () => void;
}

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Navigation: React.FC<NavigationProps> = ({ open, onToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const navigationItems = [
        {
            label: 'Home',
            path: '/',
            icon: <HomeIcon />
        },
        {
            label: 'Environments',
            path: '/environments',
            icon: <EnvironmentsIcon />
        },
        {
            label: 'Projects',
            path: '/projects',
            icon: <ProjectsIcon />
        },
        {
            label: 'Components',
            path: '/components',
            icon: <ComponentsIcon />
        },
        {
            label: 'Runtimes',
            path: '/runtimes',
            icon: <RuntimesIcon />
        },
        {
            label: 'Overview',
            path: '/environment-overview',
            icon: <OverviewIcon />
        },
    ];

    const handleNavigate = (path: string) => {
        navigate(path);
    };

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
                    boxSizing: 'border-box',
                    transition: (theme) =>
                        theme.transitions.create('width', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                    overflowX: 'hidden',
                },
            }}
        >
            <Toolbar />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                <IconButton onClick={onToggle} size="small">
                    {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </IconButton>
            </Box>

            <Divider />

            <List>
                {navigationItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <ListItem key={item.path} disablePadding>
                            <ListItemButton
                                onClick={() => handleNavigate(item.path)}
                                selected={isActive}
                                sx={{
                                    minHeight: 48,
                                    justifyContent: open ? 'initial' : 'center',
                                    px: 2.5,
                                    '&.Mui-selected': {
                                        backgroundColor: 'primary.light',
                                        color: 'primary.contrastText',
                                        '&:hover': {
                                            backgroundColor: 'primary.main',
                                        },
                                        '& .MuiListItemIcon-root': {
                                            color: 'primary.contrastText',
                                        },
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 0,
                                        mr: open ? 3 : 'auto',
                                        justifyContent: 'center',
                                        color: isActive ? 'inherit' : 'action.active',
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    sx={{
                                        opacity: open ? 1 : 0,
                                        transition: (theme) =>
                                            theme.transitions.create('opacity', {
                                                easing: theme.transitions.easing.sharp,
                                                duration: theme.transitions.duration.short,
                                            }),
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Drawer>
    );
};

export { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED };
export default Navigation;