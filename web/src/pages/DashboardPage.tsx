import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DomainStats {
  domainCount: number;
  lastUsedAt: string | null;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/domains/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch domain stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  const generateApiKey = async () => {
    setGeneratingKey(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/auth/api-key`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.apiKey && user) {
        updateUser({ ...user, apiKey: data.apiKey });
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyApiKey = async () => {
    if (user?.apiKey) {
      await navigator.clipboard.writeText(user.apiKey);
      setCopied(true);
    }
  };

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 800 }}>
        <Typography variant="h1" sx={{ mb: 0.5, color: '#e0e0e0' }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
          Manage your account and API keys
        </Typography>

        {/* Account Info */}
        <Box
          sx={{
            p: 2.5,
            mb: 2,
            borderRadius: 1,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography variant="h3" sx={{ mb: 2, color: '#e0e0e0' }}>
            Account
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Box>
              <Typography variant="body2" sx={{ color: '#555', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email
              </Typography>
              <Typography sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>{user?.email}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: '#555', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Plan
              </Typography>
              <Typography sx={{ color: user?.isPaid ? '#50e3c2' : '#e0e0e0', fontSize: '0.8rem' }}>
                {user?.isPaid ? 'Paid' : 'Free'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: '#555', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Role
              </Typography>
              <Typography sx={{ color: '#e0e0e0', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                {user?.role}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Upgrade Banner for Free Users */}
        {!user?.isPaid && (
          <Box
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: 1,
              border: '1px solid rgba(120, 119, 198, 0.3)',
              background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.1) 0%, rgba(80, 227, 194, 0.05) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <RocketLaunchIcon sx={{ color: '#7877c6', fontSize: 20 }} />
              <Box>
                <Typography sx={{ color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 500 }}>
                  Upgrade to Pro
                </Typography>
                <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>
                  Get more domains, bandwidth, and request logs
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/pricing')}
              sx={{ px: 3 }}
            >
              View Plans
            </Button>
          </Box>
        )}

        {/* Domain Stats */}
        <Box
          sx={{
            p: 2.5,
            mb: 2,
            borderRadius: 1,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography variant="h3" sx={{ mb: 2, color: '#e0e0e0' }}>
            Domains
          </Typography>
          
          {loadingStats ? (
            <CircularProgress size={16} sx={{ color: '#666' }} />
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <Box>
                <Typography variant="body2" sx={{ color: '#555', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Domains
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
                  {stats?.domainCount ?? 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: '#555', mb: 0.25, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last Used
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
                  {formatLastUsed(stats?.lastUsedAt ?? null)}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* API Key */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 1,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography variant="h3" sx={{ mb: 2, color: '#e0e0e0' }}>
            API Key
          </Typography>

          {user?.apiKey ? (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.3)',
                  mb: 2,
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    fontFamily: 'inherit',
                    fontSize: '0.75rem',
                    color: '#e0e0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.apiKey}
                </Typography>
                <IconButton onClick={copyApiKey} size="small" sx={{ color: '#666' }}>
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              <Typography variant="body2" sx={{ color: '#555', mb: 1, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Usage
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.7rem',
                  color: '#888',
                }}
              >
                knrog 3000 --api-key {user.apiKey.slice(0, 15)}...
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body1" sx={{ mb: 2, fontSize: '0.8rem' }}>
                Generate an API key to use Knrog tunnels.
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={generateApiKey}
                disabled={generatingKey}
                startIcon={generatingKey ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 12 }} />}
              >
                {generatingKey ? 'Generating...' : 'Generate API Key'}
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </DashboardLayout>
  );
}

