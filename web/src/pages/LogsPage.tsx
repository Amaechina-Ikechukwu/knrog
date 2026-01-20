import { useState, useEffect } from 'react';
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
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockIcon from '@mui/icons-material/Lock';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

interface LogEntry {
  id: string;
  subdomain: string;
  method: string;
  path: string;
  statusCode: number | null;
  responseTime: number | null;
  createdAt: string;
}

export default function LogsPage() {
  const { user, domains, fetchDomains } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  // Check if user has paid-tier access
  const SPECIAL_EMAILS = ["amaechinaikechukwu6@gmail.com"];
  const hasPaidAccess = user?.isPaid || (user?.email && SPECIAL_EMAILS.includes(user.email));

  const fetchLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const params = selectedDomain !== 'all' ? `?subdomain=${selectedDomain}` : '';
      const response = await fetch(`${API_URL}/api/domains/logs${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  useEffect(() => {
    if (hasPaidAccess) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [hasPaidAccess, selectedDomain]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: number | null) => {
    if (!status) return '#666';
    if (status >= 200 && status < 300) return '#50e3c2';
    if (status >= 300 && status < 400) return '#ffc107';
    if (status >= 400 && status < 500) return '#ff9800';
    if (status >= 500) return '#f44336';
    return '#666';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return '#50e3c2';
      case 'POST': return '#ffc107';
      case 'PUT': return '#ff9800';
      case 'DELETE': return '#f44336';
      case 'PATCH': return '#9c27b0';
      default: return '#666';
    }
  };

  // Locked state for free users
  if (!hasPaidAccess) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, maxWidth: 900 }}>
          <Typography variant="h1" sx={{ mb: 0.5, color: '#e0e0e0' }}>
            Request Logs
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
            View HTTP requests through your tunnels
          </Typography>

          <Box
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 1,
              border: '1px solid rgba(255, 193, 7, 0.3)',
              background: 'rgba(255, 193, 7, 0.03)',
            }}
          >
            <LockIcon sx={{ color: '#ffc107', fontSize: 48, mb: 2 }} />
            <Typography variant="h3" sx={{ color: '#e0e0e0', mb: 1 }}>
              Premium Feature
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mb: 3, maxWidth: 400, mx: 'auto' }}>
              Request logs are available on paid plans. Track every HTTP request through your tunnels with method, path, status code, and response time.
            </Typography>
            <Button
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                color: '#000',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #ffca28 0%, #ffa726 100%)',
                },
              }}
            >
              Upgrade to Pro
            </Button>
          </Box>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 1100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="h1" sx={{ color: '#e0e0e0' }}>
            Request Logs
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                sx={{
                  fontSize: '0.75rem',
                  color: '#e0e0e0',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <MenuItem value="all">All domains</MenuItem>
                {domains.map((d) => (
                  <MenuItem key={d.subdomain} value={d.subdomain}>
                    {d.subdomain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 12 }} />}
              onClick={fetchLogs}
              sx={{ color: '#666', fontSize: '0.7rem' }}
            >
              Refresh
            </Button>
          </Box>
        </Box>
        <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
          HTTP requests through your tunnels
        </Typography>

        {loading ? (
          <CircularProgress size={16} sx={{ color: '#666' }} />
        ) : logs.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography variant="body1" sx={{ color: '#555', mb: 1, fontSize: '0.8rem' }}>
              No logs yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#444', fontSize: '0.7rem' }}>
              Logs will appear when HTTP requests are made to your active tunnels
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
            }}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 70 }}>Method</TableCell>
                    <TableCell>Path</TableCell>
                    <TableCell sx={{ width: 100 }}>Domain</TableCell>
                    <TableCell sx={{ width: 70 }}>Status</TableCell>
                    <TableCell sx={{ width: 80 }}>Time</TableCell>
                    <TableCell sx={{ width: 150 }}>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}
                    >
                      <TableCell>
                        <Chip
                          label={log.method}
                          size="small"
                          sx={{
                            bgcolor: 'transparent',
                            color: getMethodColor(log.method),
                            border: `1px solid ${getMethodColor(log.method)}`,
                            fontSize: '0.65rem',
                            height: 20,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: '#e0e0e0',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.path}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.7rem', color: '#888' }}>
                          {log.subdomain}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            color: getStatusColor(log.statusCode),
                            fontWeight: 500,
                          }}
                        >
                          {log.statusCode || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                          {log.responseTime ? `${log.responseTime}ms` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.65rem', color: '#555' }}>
                          {formatDate(log.createdAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}
