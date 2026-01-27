import { Box, Container, Typography, Button, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GitHubIcon from '@mui/icons-material/GitHub';
import LockIcon from '@mui/icons-material/Lock';
import SpeedIcon from '@mui/icons-material/Speed';
import CodeIcon from '@mui/icons-material/Code';
import WebhookIcon from '@mui/icons-material/Webhook';
import CloudIcon from '@mui/icons-material/Cloud';
import BugReportIcon from '@mui/icons-material/BugReport';
import GroupIcon from '@mui/icons-material/Group';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const features = [
  {
    icon: <SpeedIcon sx={{ fontSize: 28 }} />,
    title: 'Instant Tunnels',
    description: 'Expose your local server to the internet in seconds. No configuration needed.',
  },
  {
    icon: <LockIcon sx={{ fontSize: 28 }} />,
    title: 'Secure by Default',
    description: 'All connections are encrypted with HTTPS. Your data stays safe.',
  },
  {
    icon: <CodeIcon sx={{ fontSize: 28 }} />,
    title: 'Custom Subdomains',
    description: 'Keep your subdomain across sessions. Share permanent URLs.',
  },
  {
    icon: <WebhookIcon sx={{ fontSize: 28 }} />,
    title: 'Request Inspection',
    description: 'View every HTTP request in real-time with method, path, and status.',
  },
];

const useCases = [
  {
    icon: <CloudIcon sx={{ fontSize: 24, color: '#7877c6' }} />,
    title: 'Webhook Development',
    description: 'Test webhooks from Stripe, GitHub, Twilio, and more locally.',
  },
  {
    icon: <BugReportIcon sx={{ fontSize: 24, color: '#50e3c2' }} />,
    title: 'Debug Remote APIs',
    description: 'Expose local APIs for mobile apps and external services.',
  },
  {
    icon: <GroupIcon sx={{ fontSize: 24, color: '#ffc107' }} />,
    title: 'Client Demos',
    description: 'Share your work-in-progress with clients before deployment.',
  },
];

const steps = [
  { number: '01', title: 'Create an account', description: 'Sign up and get your API key in seconds' },
  { number: '02', title: 'Run the CLI', description: 'Execute one command to start your tunnel' },
  { number: '03', title: 'Share your URL', description: 'Your local server is now publicly accessible' },
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
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#e0e0e0' }}>
              knrog
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="text"
                onClick={() => navigate('/pricing')}
                sx={{ fontSize: '0.875rem', color: '#888', '&:hover': { color: '#e0e0e0' } }}
              >
                Pricing
              </Button>
              <Button
                variant="text"
                startIcon={<GitHubIcon sx={{ fontSize: 18 }} />}
                href="https://github.com"
                target="_blank"
                sx={{ fontSize: '0.875rem', color: '#888', '&:hover': { color: '#e0e0e0' } }}
              >
                GitHub
              </Button>
              <Button
                variant="text"
                onClick={() => navigate('/login')}
                sx={{ fontSize: '0.875rem', color: '#888', '&:hover': { color: '#e0e0e0' } }}
              >
                Log in
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

          <Typography variant="h1" sx={{ mb: 3, color: '#EDEDED', fontSize: { xs: '2.5rem', md: '4rem' } }}>
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
              maxWidth: 560, 
              mx: 'auto', 
              mb: 5,
              fontSize: '1.25rem',
              lineHeight: 1.6,
              color: '#888',
            }}
          >
            Knrog creates secure tunnels from the public internet to your local 
            development environment. Test webhooks, share demos, and debug like never before.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              sx={{ px: 4, py: 1.5 }}
            >
              Start for free
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/pricing')}
              sx={{ 
                px: 4, 
                py: 1.5,
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#e0e0e0',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              View Pricing
            </Button>
          </Box>
        </Box>

        {/* Terminal Demo */}
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
            <Box sx={{ color: '#666', mb: 1 }}>$ npx knrog http 3000</Box>
            <Box sx={{ color: '#50e3c2', mb: 2 }}>✓ Connected to knrog.online</Box>
            <Box sx={{ color: '#EDEDED' }}>
              <Box>Your tunnel is live at:</Box>
              <Box sx={{ color: '#FFFFFF', mt: 1, fontSize: '1.1rem' }}>
                → <Box component="span" sx={{ color: '#7877c6', textDecoration: 'underline' }}>happy-hippo.knrog.online</Box>
              </Box>
            </Box>
            <Box sx={{ color: '#666', mt: 3, fontSize: '0.8rem' }}>
              Forwarding HTTP traffic to localhost:3000
            </Box>
          </Box>
        </Box>

        {/* How it works */}
        <Box sx={{ pb: 16 }}>
          <Typography
            variant="h2"
            sx={{ textAlign: 'center', mb: 2, color: '#EDEDED' }}
          >
            How it works
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', mb: 8, color: '#666', maxWidth: 500, mx: 'auto' }}
          >
            Get up and running in under a minute
          </Typography>
          
          <Grid container spacing={4}>
            {steps.map((step, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Box
                  sx={{
                    p: 4,
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)',
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '3rem',
                      fontWeight: 700,
                      color: 'rgba(120, 119, 198, 0.3)',
                      mb: 2,
                    }}
                  >
                    {step.number}
                  </Typography>
                  <Typography variant="h3" sx={{ mb: 1, color: '#EDEDED' }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    {step.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Features */}
        <Box sx={{ pb: 16 }}>
          <Typography
            variant="h2"
            sx={{ textAlign: 'center', mb: 2, color: '#EDEDED' }}
          >
            Built for developers
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', mb: 8, color: '#666', maxWidth: 500, mx: 'auto' }}
          >
            Everything you need to expose your local services safely
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
                      borderColor: 'rgba(120, 119, 198, 0.3)',
                      background: 'rgba(120, 119, 198, 0.05)',
                    },
                  }}
                >
                  <Box sx={{ color: '#7877c6', mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h3" sx={{ mb: 1, color: '#EDEDED' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    {feature.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Use Cases */}
        <Box sx={{ pb: 16 }}>
          <Typography
            variant="h2"
            sx={{ textAlign: 'center', mb: 2, color: '#EDEDED' }}
          >
            Perfect for every use case
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', mb: 8, color: '#666', maxWidth: 500, mx: 'auto' }}
          >
            From webhook testing to client demos
          </Typography>
          
          <Grid container spacing={3}>
            {useCases.map((useCase, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Box
                  sx={{
                    p: 4,
                    height: '100%',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Box sx={{ mb: 2 }}>
                    {useCase.icon}
                  </Box>
                  <Typography variant="h3" sx={{ mb: 1, color: '#EDEDED' }}>
                    {useCase.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    {useCase.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Pricing Preview */}
        <Box
          sx={{
            py: 12,
            mb: 16,
            borderRadius: 3,
            border: '1px solid rgba(120, 119, 198, 0.2)',
            background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.08) 0%, rgba(80, 227, 194, 0.03) 100%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, color: '#EDEDED' }}>
            Simple, transparent pricing
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#666', maxWidth: 400, mx: 'auto' }}>
            Start free, upgrade when you need more power
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#50e3c2', fontSize: 18 }} />
              <Typography sx={{ color: '#e0e0e0', fontSize: '0.9rem' }}>Free tier available</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#50e3c2', fontSize: 18 }} />
              <Typography sx={{ color: '#e0e0e0', fontSize: '0.9rem' }}>No credit card required</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#50e3c2', fontSize: 18 }} />
              <Typography sx={{ color: '#e0e0e0', fontSize: '0.9rem' }}>Cancel anytime</Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/pricing')}
            sx={{ px: 5, py: 1.5 }}
          >
            View all plans
          </Button>
        </Box>

        {/* Final CTA */}
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
          <Typography variant="body1" sx={{ mb: 4, color: '#666' }}>
            Start tunneling in under a minute. No credit card required.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
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
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: '#444' }}>
            © 2025 Knrog. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography
              component="a"
              href="/pricing"
              onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}
              variant="body2"
              sx={{ color: '#666', cursor: 'pointer', textDecoration: 'none', '&:hover': { color: '#888' } }}
            >
              Pricing
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: '#666', cursor: 'pointer', '&:hover': { color: '#888' } }}
            >
              Docs
            </Typography>
            <Typography
              component="a"
              href="https://github.com"
              target="_blank"
              variant="body2"
              sx={{ color: '#666', cursor: 'pointer', textDecoration: 'none', '&:hover': { color: '#888' } }}
            >
              GitHub
            </Typography>
            <Typography
              component="a"
              href="mailto:support@knrog.online"
              variant="body2"
              sx={{ color: '#666', cursor: 'pointer', textDecoration: 'none', '&:hover': { color: '#888' } }}
            >
              Contact
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
