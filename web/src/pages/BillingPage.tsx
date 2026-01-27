import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UsageData {
  requestCount: number;
  bandwidthBytes: number;
  billingPeriod: string;
}

interface Limits {
  domains: number;
  connections: number;
  bandwidthBytes: number;
  logRetentionDays: number;
  customSubdomains: boolean;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  flutterwaveRef: string;
}

interface BillingData {
  plan: string;
  subscription: Subscription | null;
  usage: UsageData;
  limits: Limits;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes === Infinity) return 'Unlimited';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function BillingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check for payment callback
  useEffect(() => {
    const txRef = searchParams.get('tx_ref');
    const status = searchParams.get('status');

    if (txRef && status === 'successful') {
      verifyPayment(txRef);
    } else if (status === 'cancelled') {
      setAlert({ type: 'error', message: 'Payment was cancelled.' });
    }
  }, [searchParams]);

  const verifyPayment = async (txRef: string) => {
    setVerifying(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/billing/verify/${txRef}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        setAlert({ type: 'success', message: 'Payment successful! Your subscription is now active.' });
        fetchBillingData();
      } else {
        setAlert({ type: 'error', message: data.message || 'Payment verification failed.' });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setAlert({ type: 'error', message: 'Failed to verify payment. Please contact support.' });
    } finally {
      setVerifying(false);
      // Clear URL params
      window.history.replaceState({}, '', '/billing');
    }
  };

  const fetchBillingData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [subResponse, paymentsResponse] = await Promise.all([
        fetch(`${API_URL}/api/billing/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/billing/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (subResponse.ok) {
        const data = await subResponse.json();
        setBillingData(data);
      }

      if (paymentsResponse.ok) {
        const data = await paymentsResponse.json();
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleCancelSubscription = async () => {
    setCancelling(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        setAlert({ type: 'success', message: data.message });
        fetchBillingData();
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to cancel subscription.' });
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      setAlert({ type: 'error', message: 'Failed to cancel subscription.' });
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
    }
  };

  const usagePercentage = billingData
    ? Math.min(100, (billingData.usage.bandwidthBytes / billingData.limits.bandwidthBytes) * 100)
    : 0;

  if (loading || verifying) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress sx={{ color: '#7877c6' }} />
          {verifying && (
            <Typography sx={{ ml: 2, color: '#888' }}>Verifying payment...</Typography>
          )}
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 900 }}>
        <Typography variant="h1" sx={{ mb: 0.5, color: '#e0e0e0' }}>
          Billing
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
          Manage your subscription and view usage
        </Typography>

        {alert && (
          <Alert
            severity={alert.type}
            onClose={() => setAlert(null)}
            sx={{
              mb: 3,
              bgcolor: alert.type === 'success' ? 'rgba(80, 227, 194, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${alert.type === 'success' ? 'rgba(80, 227, 194, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: alert.type === 'success' ? '#50e3c2' : '#f87171',
            }}
          >
            {alert.message}
          </Alert>
        )}

        {/* Current Plan */}
        <Card
          sx={{
            mb: 3,
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h3" sx={{ color: '#e0e0e0', mb: 0.5 }}>
                  Current Plan
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ color: '#7877c6', fontSize: '1.5rem', fontWeight: 600 }}>
                    {billingData?.plan.charAt(0).toUpperCase()}{billingData?.plan.slice(1)}
                  </Typography>
                  {billingData?.subscription?.status === 'cancelled' && (
                    <Chip label="Cancels at period end" size="small" color="warning" />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {billingData?.plan !== 'enterprise' && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => navigate('/pricing')}
                  >
                    Upgrade
                  </Button>
                )}
                {billingData?.subscription && billingData.subscription.status === 'active' && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>

            {billingData?.subscription && (
              <Box sx={{ display: 'flex', gap: 4, color: '#888', fontSize: '0.85rem' }}>
                <Box>
                  <Typography sx={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', mb: 0.25 }}>
                    Period Start
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {formatDate(billingData.subscription.currentPeriodStart)}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', mb: 0.25 }}>
                    Period End
                  </Typography>
                  <Typography sx={{ color: '#e0e0e0' }}>
                    {formatDate(billingData.subscription.currentPeriodEnd)}
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card
          sx={{
            mb: 3,
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h3" sx={{ color: '#e0e0e0', mb: 3 }}>
              Usage This Period
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ color: '#888', fontSize: '0.85rem' }}>
                  Bandwidth
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                  {formatBytes(billingData?.usage.bandwidthBytes || 0)} / {formatBytes(billingData?.limits.bandwidthBytes || 0)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={usagePercentage}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: usagePercentage > 80 ? '#f87171' : usagePercentage > 50 ? '#fbbf24' : '#50e3c2',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 4 }}>
              <Box>
                <Typography sx={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', mb: 0.25 }}>
                  Requests
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '1.25rem', fontWeight: 600 }}>
                  {billingData?.usage.requestCount.toLocaleString() || 0}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', mb: 0.25 }}>
                  Domains Used
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '1.25rem', fontWeight: 600 }}>
                  - / {billingData?.limits.domains === Infinity ? '∞' : billingData?.limits.domains}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', mb: 0.25 }}>
                  Connections
                </Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: '1.25rem', fontWeight: 600 }}>
                  - / {billingData?.limits.connections === Infinity ? '∞' : billingData?.limits.connections}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card
          sx={{
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h3" sx={{ color: '#e0e0e0', mb: 3 }}>
              Payment History
            </Typography>

            {payments.length === 0 ? (
              <Typography sx={{ color: '#666', fontSize: '0.9rem' }}>
                No payments yet.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#666', borderColor: 'rgba(255,255,255,0.06)' }}>Date</TableCell>
                      <TableCell sx={{ color: '#666', borderColor: 'rgba(255,255,255,0.06)' }}>Amount</TableCell>
                      <TableCell sx={{ color: '#666', borderColor: 'rgba(255,255,255,0.06)' }}>Status</TableCell>
                      <TableCell sx={{ color: '#666', borderColor: 'rgba(255,255,255,0.06)' }}>Reference</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell sx={{ color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.06)' }}>
                          {formatDate(payment.createdAt)}
                        </TableCell>
                        <TableCell sx={{ color: '#e0e0e0', borderColor: 'rgba(255,255,255,0.06)' }}>
                          ₦{(payment.amount / 100).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          <Chip
                            label={payment.status}
                            size="small"
                            color={payment.status === 'successful' ? 'success' : payment.status === 'pending' ? 'warning' : 'error'}
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }}>
                          {payment.flutterwaveRef?.slice(0, 20)}...
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#e0e0e0' }}>Cancel Subscription?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#888' }}>
            Your subscription will remain active until the end of your current billing period.
            After that, you'll be downgraded to the free plan.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} sx={{ color: '#888' }}>
            Keep Subscription
          </Button>
          <Button
            onClick={handleCancelSubscription}
            color="error"
            disabled={cancelling}
          >
            {cancelling ? <CircularProgress size={16} /> : 'Cancel Subscription'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
