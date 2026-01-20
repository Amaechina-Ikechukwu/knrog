import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFFFFF',
      contrastText: '#000000',
    },
    secondary: {
      main: '#666666',
    },
    background: {
      default: '#0a0a0a',
      paper: '#111111',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#888888',
    },
    divider: 'rgba(255, 255, 255, 0.06)',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
    fontSize: 13,
    h1: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '0.95rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.8125rem',
      lineHeight: 1.5,
      color: '#888888',
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: '#666666',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.75rem',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        html {
          scroll-behavior: smooth;
          font-size: 14px;
        }
        
        body {
          background: #0a0a0a;
        }
        
        ::selection {
          background: rgba(255, 255, 255, 0.15);
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '5px 10px',
          borderRadius: 4,
          transition: 'all 120ms ease',
          fontWeight: 500,
          minHeight: 28,
        },
        sizeSmall: {
          padding: '3px 8px',
          fontSize: '0.7rem',
          minHeight: 24,
        },
        contained: {
          background: '#FFFFFF',
          color: '#000000',
          boxShadow: 'none',
          '&:hover': {
            background: '#E5E5E5',
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.12)',
          color: '#e0e0e0',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
            background: 'rgba(255, 255, 255, 0.03)',
          },
        },
        text: {
          color: '#888888',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#e0e0e0',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 6,
        },
        sizeSmall: {
          padding: 4,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 6,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontSize: '0.8125rem',
            background: 'rgba(255, 255, 255, 0.02)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderWidth: 1,
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.8125rem',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        },
        head: {
          fontWeight: 600,
          color: '#666666',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 20,
          fontSize: '0.65rem',
        },
        sizeSmall: {
          height: 18,
          fontSize: '0.6rem',
        },
      },
    },
  },
});

export default theme;
