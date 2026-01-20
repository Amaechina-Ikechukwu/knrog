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
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export default function DomainsPage() {
  const navigate = useNavigate();
  const { domains, loading, fetchDomains } = useAuth();

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
        <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
          Your registered tunnel domains
        </Typography>

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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {domains.map((domain) => (
                      <TableRow
                        key={domain.subdomain}
                        sx={{
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        }}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}
