import { useState, useEffect } from 'react';
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
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cliSessionId = searchParams.get('cliSessionId');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Show special message if registering from CLI
  useEffect(() => {
    if (cliSessionId) {
      console.log('[Knrog Web] CLI session detected:', cliSessionId);
    }
  }, [cliSessionId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password,
          cliSessionId: cliSessionId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // If CLI session, show the API key
      if (cliSessionId && data.apiKey) {
        setApiKey(data.apiKey);
      }
      
      setSuccess(true);
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
          {!success ? (
            <>
              <Typography variant="h2" sx={{ mb: 1, color: '#EDEDED', textAlign: 'center' }}>
                Create your account
              </Typography>
              <Typography variant="body1" sx={{ mb: 5, textAlign: 'center' }}>
                {cliSessionId 
                  ? 'Complete registration to activate your CLI tunnel' 
                  : 'Get started with Knrog for free'}
              </Typography>

              {cliSessionId && (
                <Alert 
                  severity="info" 
                  sx={{ 
                    mb: 3, 
                    bgcolor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                  }}
                >
                  <Typography variant="body2">
                    <strong>CLI Registration:</strong> Your API key will be automatically sent to your terminal after registration.
                  </Typography>
                </Alert>
              )}

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

              <Box component="form" onSubmit={handleRegister}>
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
                  sx={{ mb: 3 }}
                  autoComplete="new-password"
                />

                <Typography variant="body2" sx={{ mb: 1, color: '#888' }}>
                  Confirm password
                </Typography>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  sx={{ mb: 4 }}
                  autoComplete="new-password"
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.5 }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Create account'}
                </Button>
              </Box>

              <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

              <Typography variant="body2" sx={{ textAlign: 'center', color: '#666' }}>
                Already have an account?{' '}
                <MuiLink component={Link} to="/login" sx={{ color: '#EDEDED' }}>
                  Sign in
                </MuiLink>
              </Typography>
            </>
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              {cliSessionId && apiKey ? (
                <>
                  <Typography variant="h2" sx={{ mb: 2, color: '#EDEDED' }}>
                    ✓ Account created!
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    Your CLI will automatically receive the API key and start the tunnel.
                  </Typography>
                  <Alert 
                    severity="success" 
                    sx={{ 
                      mb: 3, 
                      bgcolor: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      textAlign: 'left',
                    }}
                  >
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                      Your API Key (saved automatically):
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.9rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {apiKey}
                    </Typography>
                  </Alert>
                  <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                    You can close this window and return to your terminal.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h2" sx={{ mb: 2, color: '#EDEDED' }}>
                    Check your email
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 4 }}>
                    We've sent a verification link to <strong>{email}</strong>
                  </Typography>
                  <Button variant="outlined" onClick={() => navigate('/login')}>
                    Go to login
                  </Button>
                </>
              )}
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
