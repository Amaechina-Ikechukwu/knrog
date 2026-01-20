import { type ReactNode } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_WIDTH = 200;

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon sx={{ fontSize: 14 }} /> },
  { label: 'Domains', path: '/domains', icon: <DnsIcon sx={{ fontSize: 14 }} /> },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout: authLogout } = useAuth();

  const handleLogout = () => {
    authLogout();
    navigate('/');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={20} sx={{ color: '#666' }} />
      </Box>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#e0e0e0',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            knrog
          </Typography>
        </Box>

        {/* Navigation */}
        <Box sx={{ flex: 1, py: 1.5, px: 1 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                fullWidth
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{
                  justifyContent: 'flex-start',
                  px: 1.5,
                  py: 0.75,
                  mb: 0.5,
                  color: isActive ? '#e0e0e0' : '#666',
                  bgcolor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.06)',
                    color: '#e0e0e0',
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: 1,
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>

        {/* User Section */}
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Typography
            variant="body2"
            sx={{
              color: '#666',
              fontSize: '0.65rem',
              mb: 1,
              px: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </Typography>
          <Button
            fullWidth
            size="small"
            startIcon={<LogoutIcon sx={{ fontSize: 12 }} />}
            onClick={handleLogout}
            sx={{
              justifyContent: 'flex-start',
              px: 1.5,
              py: 0.5,
              color: '#666',
              fontSize: '0.7rem',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
                color: '#888',
              },
              '& .MuiButton-startIcon': {
                marginRight: 0.75,
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}
