import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Link as MuiLink,
} from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export default function LoginPage() {
  const navigate = useNavigate();
  const { fetchUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Fetch user data to update AuthContext
      await fetchUser();

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          maxWidth: 800,
          height: 400,
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(120, 119, 198, 0.12), transparent)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative' }}>
        <Button
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/')}
          sx={{ mb: 6, color: '#666', '&:hover': { color: '#888' } }}
        >
          Back
        </Button>

        <Box
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(10,10,10,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Typography variant="h2" sx={{ mb: 1, color: '#EDEDED', textAlign: 'center' }}>
            Welcome back
          </Typography>
          <Typography variant="body1" sx={{ mb: 5, textAlign: 'center' }}>
            Sign in to your account
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleLogin}>
            <Typography variant="body2" sx={{ mb: 1, color: '#888' }}>
              Email address
            </Typography>
            <TextField
              fullWidth
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 3 }}
              autoComplete="email"
              autoFocus
            />

            <Typography variant="body2" sx={{ mb: 1, color: '#888' }}>
              Password
            </Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 4 }}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
            </Button>
          </Box>

          <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

          <Typography variant="body2" sx={{ textAlign: 'center', color: '#666' }}>
            Don't have an account?{' '}
            <MuiLink component={Link} to="/register" sx={{ color: '#EDEDED' }}>
              Sign up
            </MuiLink>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
