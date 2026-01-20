import { useEffect,useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, CircularProgress, Alert, Button } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setStatus('success');
      setMessage('Email verified successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
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
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            p: 6,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(10,10,10,0.6)',
            textAlign: 'center',
          }}
        >
          {status === 'loading' && (
            <>
              <CircularProgress sx={{ color: '#fff', mb: 3 }} />
              <Typography variant="h3" sx={{ color: '#EDEDED' }}>
                Verifying your email...
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'rgba(80, 227, 194, 0.1)',
                  border: '1px solid rgba(80, 227, 194, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <CheckIcon sx={{ color: '#50e3c2', fontSize: 32 }} />
              </Box>
              <Typography variant="h3" sx={{ mb: 2, color: '#EDEDED' }}>
                {message}
              </Typography>
              <Typography variant="body1" sx={{ mb: 4 }}>
                You can now log in to your account.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <ErrorIcon sx={{ color: '#f87171', fontSize: 32 }} />
              </Box>
              <Alert severity="error" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Button variant="outlined" onClick={() => navigate('/register')}>
                Try Again
              </Button>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
