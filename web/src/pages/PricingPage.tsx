import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const features: PlanFeature[] = [
  { name: 'Custom Domains', free: '1', pro: '10', enterprise: 'Unlimited' },
  { name: 'Concurrent Connections', free: '1', pro: '5', enterprise: 'Unlimited' },
  { name: 'Monthly Bandwidth', free: '500MB', pro: '10GB', enterprise: 'Unlimited' },
  { name: 'Request Logs', free: false, pro: '7 days', enterprise: '30 days' },
  { name: 'Custom Subdomains', free: false, pro: true, enterprise: true },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '₦0',
    period: '/forever',
    description: 'For personal projects and testing',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₦2,500',
    period: '/month',
    description: 'For developers and small teams',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '₦10,000',
    period: '/month',
    description: 'For businesses and large teams',
    popular: false,
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(planId);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/billing/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await response.json();

      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        console.error('No payment link returned');
      }
    } catch (error) {
      console.error('Failed to initialize payment:', error);
    } finally {
      setLoading(null);
    }
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircleIcon sx={{ color: '#50e3c2', fontSize: 18 }} />
      ) : (
        <CancelIcon sx={{ color: '#555', fontSize: 18 }} />
      );
    }
    return (
      <Typography sx={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
        {value}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#000',
        py: 8,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 1200,
          height: 500,
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(120, 119, 198, 0.15), transparent)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Button
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/')}
          sx={{ mb: 4, color: '#666', '&:hover': { color: '#888' } }}
        >
          Back
        </Button>

        <Typography
          variant="h1"
          sx={{
            textAlign: 'center',
            mb: 2,
            color: '#EDEDED',
            fontSize: { xs: '2rem', md: '3rem' },
          }}
        >
          Simple, Transparent Pricing
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            mb: 6,
            color: '#888',
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          Choose the plan that fits your needs. All plans include secure tunneling and HTTPS.
        </Typography>

        {/* Pricing Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
            mb: 8,
          }}
        >
          {plans.map((plan) => (
            <Card
              key={plan.id}
              sx={{
                bgcolor: plan.popular ? 'rgba(120, 119, 198, 0.1)' : 'rgba(255,255,255,0.02)',
                border: plan.popular
                  ? '1px solid rgba(120, 119, 198, 0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
                position: 'relative',
                transition: 'transform 0.2s, border-color 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  borderColor: plan.popular
                    ? 'rgba(120, 119, 198, 0.6)'
                    : 'rgba(255,255,255,0.15)',
                },
              }}
            >
              {plan.popular && (
                <Chip
                  label="Most Popular"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'rgba(120, 119, 198, 0.8)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                />
              )}
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h3" sx={{ color: '#e0e0e0', mb: 1 }}>
                  {plan.name}
                </Typography>
                <Typography sx={{ color: '#666', fontSize: '0.85rem', mb: 3 }}>
                  {plan.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 4 }}>
                  <Typography
                    sx={{
                      fontSize: '2.5rem',
                      fontWeight: 700,
                      color: '#e0e0e0',
                    }}
                  >
                    {plan.price}
                  </Typography>
                  <Typography sx={{ color: '#666', ml: 0.5 }}>
                    {plan.period}
                  </Typography>
                </Box>

                <Button
                  variant={plan.popular ? 'contained' : 'outlined'}
                  fullWidth
                  size="large"
                  disabled={loading !== null}
                  onClick={() => handleSubscribe(plan.id)}
                  sx={{
                    py: 1.5,
                    ...(plan.popular
                      ? {}
                      : {
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#e0e0e0',
                          '&:hover': {
                            borderColor: 'rgba(255,255,255,0.4)',
                            bgcolor: 'rgba(255,255,255,0.05)',
                          },
                        }),
                  }}
                >
                  {loading === plan.id ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : plan.id === 'free' ? (
                    'Get Started'
                  ) : (
                    'Subscribe'
                  )}
                </Button>

                <List sx={{ mt: 3 }}>
                  {features.map((feature) => (
                    <ListItem key={feature.name} sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {renderFeatureValue(
                          plan.id === 'free'
                            ? feature.free
                            : plan.id === 'pro'
                            ? feature.pro
                            : feature.enterprise
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={feature.name}
                        primaryTypographyProps={{
                          sx: { color: '#888', fontSize: '0.85rem' },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* FAQ or additional info */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography sx={{ color: '#666', fontSize: '0.9rem' }}>
            Questions? Contact us at{' '}
            <Typography
              component="a"
              href="mailto:support@knrog.online"
              sx={{ color: '#7877c6', textDecoration: 'none' }}
            >
              support@knrog.online
            </Typography>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
