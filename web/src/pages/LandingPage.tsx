import { Box, Container, Typography, Button, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GitHubIcon from '@mui/icons-material/GitHub';

const features = [
  {
    title: 'Instant Tunnels',
    description: 'Expose your local server to the internet in seconds.',
  },
  {
    title: 'Secure by Default',
    description: 'All connections are encrypted end-to-end.',
  },
  {
    title: 'Custom Subdomains',
    description: 'Keep your subdomain across sessions.',
  },
  {
    title: 'Zero Config',
    description: 'Just run the CLI and you\'re live.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Background gradient */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 1200,
          height: 600,
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(120, 119, 198, 0.15), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Navigation */}
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              knrog
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="text"
                startIcon={<GitHubIcon sx={{ fontSize: 18 }} />}
                href="https://github.com"
                target="_blank"
                sx={{ fontSize: '0.875rem' }}
              >
                GitHub
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{ px: 3 }}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Container maxWidth="lg">
        <Box
          sx={{
            pt: { xs: 20, md: 28 },
            pb: { xs: 12, md: 20 },
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              mb: 4,
              borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              fontSize: '0.8rem',
              color: '#888',
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#50e3c2' }} />
            Now in public beta
          </Box>

          <Typography variant="h1" sx={{ mb: 3, color: '#EDEDED' }}>
            Expose localhost
            <br />
            <Box component="span" sx={{ 
              background: 'linear-gradient(to right, #FFFFFF, #888888)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              to the world
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{ 
              maxWidth: 480, 
              mx: 'auto', 
              mb: 5,
              fontSize: '1.125rem',
              color: '#888',
            }}
          >
            Knrog creates secure tunnels from the public internet to your local 
            development environment.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{ px: 4, py: 1.25 }}
            >
              Start for free
            </Button>
            <Button
              variant="outlined"
              size="large"
              sx={{ px: 4, py: 1.25 }}
            >
              Documentation
            </Button>
          </Box>
        </Box>

        {/* Terminal */}
        <Box
          sx={{
            maxWidth: 700,
            mx: 'auto',
            mb: 16,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(10,10,10,0.8)',
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FF5F57' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FEBC2E' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28C840' }} />
          </Box>
          <Box sx={{ p: 4, fontFamily: 'monospace', fontSize: '0.9rem' }}>
            <Box sx={{ color: '#666', mb: 1 }}>$ bun run client 3000</Box>
            <Box sx={{ color: '#50e3c2', mb: 2 }}>✓ Connected to server</Box>
            <Box sx={{ color: '#EDEDED' }}>
              <Box>Your tunnel is live at:</Box>
              <Box sx={{ color: '#FFFFFF', mt: 1, fontSize: '1rem' }}>
                → <Box component="span" sx={{ textDecoration: 'underline' }}>happy-hippo.knrog.online</Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Features */}
        <Box sx={{ pb: 16 }}>
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', mb: 6, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}
          >
            Features
          </Typography>
          
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Box
                  sx={{
                    p: 3,
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'all 200ms ease',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                    },
                  }}
                >
                  <Typography variant="h3" sx={{ mb: 1, color: '#EDEDED' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2">
                    {feature.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA */}
        <Box
          sx={{
            py: 16,
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, color: '#EDEDED' }}>
            Ready to ship?
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Start tunneling in under a minute.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{ px: 5, py: 1.5 }}
          >
            Get your API key
          </Button>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            py: 4,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" sx={{ color: '#444' }}>
            © 2025 Knrog
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography variant="body2" sx={{ color: '#666', cursor: 'pointer', '&:hover': { color: '#888' } }}>
              Docs
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', cursor: 'pointer', '&:hover': { color: '#888' } }}>
              GitHub
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
