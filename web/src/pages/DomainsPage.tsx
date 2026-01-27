import { useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export default function DomainsPage() {
  const navigate = useNavigate();
  const { user, domains, loading, fetchDomains } = useAuth();
  
  // Check if user has paid-tier access
  const hasPaidAccess = user?.isPaid;

  useEffect(() => {
    fetchDomains();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 900 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="h1" sx={{ color: '#e0e0e0' }}>
            Domains
          </Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 12 }} />}
            onClick={() => fetchDomains()}
            sx={{ color: '#666', fontSize: '0.7rem' }}
          >
            Refresh
          </Button>
        </Box>
        <Typography variant="body1" sx={{ mb: 2, color: '#666' }}>
          {hasPaidAccess 
            ? 'Your registered tunnel domains' 
            : 'Your tunnel domain (Free tier: 1 domain)'}
        </Typography>

        {/* Free tier domain limit banner */}
        {!hasPaidAccess && domains.length > 0 && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 1,
              border: '1px solid rgba(255, 193, 7, 0.3)',
              background: 'rgba(255, 193, 7, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <LockIcon sx={{ color: '#ffc107', fontSize: 18 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ color: '#ffc107', fontSize: '0.75rem', fontWeight: 500 }}>
                Domain Limit: 1/1
              </Typography>
              <Typography variant="body2" sx={{ color: '#888', fontSize: '0.7rem' }}>
                Upgrade to create unlimited domains
              </Typography>
            </Box>
          </Box>
        )}

        {loading && domains.length === 0 ? (
          <CircularProgress size={16} sx={{ color: '#666' }} />
        ) : (
          <Box
            sx={{
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
            }}
          >
            {domains.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#555', mb: 1.5, fontSize: '0.8rem' }}>
                  No domains yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#444', mb: 2, fontSize: '0.7rem' }}>
                  Domains appear when you start a tunnel via CLI
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/dashboard')}
                >
                  View API Key
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Subdomain</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      {hasPaidAccess && <TableCell sx={{ width: 60 }}>Logs</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow
                        key={domain.subdomain}
                        sx={{
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                          cursor: hasPaidAccess ? 'pointer' : 'default',
                        }}
                        onClick={() => hasPaidAccess && navigate(`/logs?subdomain=${domain.subdomain}`)}
                      >
                        <TableCell>
                          <Typography
                            sx={{
                              fontFamily: 'inherit',
                              fontSize: '0.75rem',
                              color: '#e0e0e0',
                            }}
                          >
                            {domain.subdomain}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={
                              <FiberManualRecordIcon
                                sx={{
                                  fontSize: 8,
                                  color: domain.isOnline ? '#50e3c2' : '#555',
                                }}
                              />
                            }
                            label={domain.isOnline ? 'Online' : 'Offline'}
                            size="small"
                            sx={{
                              bgcolor: domain.isOnline ? 'rgba(80, 227, 194, 0.08)' : 'rgba(255,255,255,0.03)',
                              color: domain.isOnline ? '#50e3c2' : '#555',
                              border: `1px solid ${domain.isOnline ? 'rgba(80, 227, 194, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                              '& .MuiChip-icon': { marginLeft: '6px' },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: '#666', fontSize: '0.7rem' }}>
                            {formatDate(domain.createdAt)}
                          </Typography>
                        </TableCell>
                        {hasPaidAccess && (
                          <TableCell>
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/logs?subdomain=${domain.subdomain}`);
                              }}
                              sx={{ 
                                color: '#50e3c2', 
                                fontSize: '0.65rem',
                                minWidth: 'auto',
                                p: 0.5,
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Subdomain Reuse Instructions */}
        {hasPaidAccess && domains.length > 0 && (
          <Box
            sx={{
              mt: 4,
              p: 3,
              borderRadius: 1,
              border: '1px solid rgba(80, 227, 194, 0.15)',
              background: 'rgba(80, 227, 194, 0.03)',
            }}
          >
            <Typography variant="body2" sx={{ color: '#50e3c2', mb: 1.5, fontWeight: 500 }}>
              ✨ Subdomain Reuse (Premium Feature)
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mb: 2, fontSize: '0.75rem' }}>
              As a premium user, you can reuse your subdomains. Use the <code style={{ color: '#e0e0e0', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>--reuse</code> flag or specify a subdomain:
            </Typography>
            <Box
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#e0e0e0',
                background: 'rgba(0,0,0,0.3)',
                p: 2,
                borderRadius: 1,
                '& .comment': { color: '#666' },
              }}
            >
              <Box sx={{ mb: 1 }}>
                <span className="comment"># Reuse your last subdomain</span>
              </Box>
              <Box sx={{ mb: 2 }}>knrog 3000 --reuse</Box>
              <Box sx={{ mb: 1 }}>
                <span className="comment"># Or specify a subdomain you own</span>
              </Box>
              <Box>knrog 3000 --subdomain {domains[0]?.subdomain || 'my-subdomain'}</Box>
            </Box>
          </Box>
        )}

        {!hasPaidAccess && domains.length > 0 && (
          <Box
            sx={{
              mt: 4,
              p: 3,
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
              💡 Want to reuse your subdomains?
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.75rem' }}>
              Upgrade to a paid plan to keep the same subdomain across sessions.
            </Typography>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}
