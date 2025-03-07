import io from 'socket.io-client';
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Slider,
  CircularProgress,
  createTheme,
  ThemeProvider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { translations } from './translations';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Translate as TranslateIcon,
  CheckCircleOutline as CheckIcon,
  PauseCircleOutline as PauseIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
});

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
  },
});

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });
  
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang');
    return saved || 'en';
  });

  const t = useCallback((key) => translations[lang][key], [lang]);

  const [dropboxToken, setDropboxToken] = useState('');
  const [sharedLink, setSharedLink] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [formattedSpeed, setFormattedSpeed] = useState('0.00 MB/s');
  const [speedHistory, setSpeedHistory] = useState([]);
  const [concurrentDownloads, setConcurrentDownloads] = useState(2);
  const [processLogs, setProcessLogs] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [downloadTasks, setDownloadTasks] = useState({});
  const [folderSize, setFolderSize] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState({
    connection: false,
    download: false,
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'ko' : 'en');
  };

  const renderToggles = () => (
    <div className="toggle-container scale-in">
      <Tooltip title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        <IconButton
          className="toggle-button"
          onClick={toggleTheme}
          size="small"
        >
          {theme === 'dark' ? (
            <LightModeIcon fontSize="small" />
          ) : (
            <DarkModeIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Tooltip title={lang === 'en' ? '한국어로 전환' : 'Switch to English'}>
        <IconButton
          className="toggle-button"
          onClick={toggleLang}
          size="small"
        >
          <TranslateIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );

  const adjustConcurrentDownloads = async (newValue) => {
    if (!Object.keys(downloadTasks).length) return;

    try {
      const response = await fetch('http://localhost:3001/api/adjust-concurrent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: newValue })
      });

      if (!response.ok) {
        throw new Error('Failed to adjust concurrent downloads');
      }
    } catch (error) {
      console.error('Error adjusting concurrent downloads:', error);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('dropboxToken');
    const savedLink = localStorage.getItem('sharedLink');
    const savedPath = localStorage.getItem('destinationPath');

    if (savedToken) setDropboxToken(savedToken);
    if (savedLink) setSharedLink(savedLink);
    if (savedPath) setDestinationPath(savedPath);
  }, []);

  useEffect(() => {
    localStorage.setItem('dropboxToken', dropboxToken);
    localStorage.setItem('sharedLink', sharedLink);
    localStorage.setItem('destinationPath', destinationPath);
  }, [dropboxToken, sharedLink, destinationPath]);

  useEffect(() => {
    let folderSizeIntervalId;
    let fileCountIntervalId;

    if (Object.keys(downloadTasks).length > 0) {
      folderSizeIntervalId = setInterval(async () => {
        const response = await fetch('http://localhost:3001/api/folder-size');
        if (response.ok) {
          const { size } = await response.json();
          setFolderSize(formatBytes(size));
        }
      }, 3000);

      fileCountIntervalId = setInterval(async () => {
        const response = await fetch('http://localhost:3001/api/file-count');
        if (response.ok) {
          const { count } = await response.json();
          setFileCount(count);
        }
      }, 3000);
    }

    return () => {
      clearInterval(folderSizeIntervalId);
      clearInterval(fileCountIntervalId);
    };
  }, [downloadTasks]);

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socket.on('connect', () => {
      console.log('Connected to backend via Socket.IO');
    });

    socket.on('log', (logData) => {
      console.log("Received log data:", logData);
      setProcessLogs((prevLogs) => {
        const { pid, type, message } = logData;
        const newLogs = { ...prevLogs };
        if (!newLogs[pid]) newLogs[pid] = [];
        newLogs[pid] = [...newLogs[pid], { type, message }];
        return newLogs;
      });
    });

    return () => {
      socket.off('log');
    }
  }, []);

  const checkConnection = async () => {
    setLoading({ ...loading, connection: true });
    try {
      const response = await fetch('http://localhost:3001/api/check-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dropboxToken }),
      });
      const data = await response.json();
      setIsConnected(data.connected);
      if (!data.connected) {
        alert('Failed to connect to Dropbox. Check your token.');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      alert('Error checking connection. See console for details.');
    } finally {
      setLoading({ ...loading, connection: false });
    }
  };

  const pauseDownload = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stop-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error pausing download:', error);
      alert('Error pausing download. See console for details.');
    }
  };

  const startDownload = async () => {
    setIsPaused(false);
    setLoading({ ...loading, download: true });
    try {
      const response = await fetch('http://localhost:3001/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dropboxToken, sharedLink, destinationPath }),
      });
      const data = await response.json();

      if (response.ok) {
        setDownloadTasks((prevTasks) => ({
          ...prevTasks,
          [data.downloadId]: {
            sharedLink,
            destinationPath,
          },
        }));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error starting download:', error);
      alert('Error starting download. See console for details.');
    } finally {
      setLoading({ ...loading, download: false });
    }
  };

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const clearDestination = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/clear-destination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        alert('Destination folder cleared successfully!');
      }
    } catch (error) {
      console.error('Error clearing destination folder:', error);
      alert('Error clearing destination folder. See console for details.');
    }
  };

  return (
    <ThemeProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
      <Container maxWidth="md" className="app-container">
        {renderToggles()}
        <Box className="app-card fade-in">
          <Typography variant="h4" component="h1" gutterBottom className="gradient-text">
            {t('title')}
          </Typography>

          <Box sx={{ mt: 4 }}>
            <TextField
              label={t('dropboxToken')}
              fullWidth
              margin="normal"
              value={dropboxToken}
              onChange={(e) => setDropboxToken(e.target.value)}
              className="input-field slide-in"
            />

            <TextField
              label={t('sharedLink')}
              fullWidth
              margin="normal"
              value={sharedLink}
              onChange={(e) => setSharedLink(e.target.value)}
              className="input-field slide-in"
            />

            <TextField
              label={t('destinationPath')}
              fullWidth
              margin="normal"
              value={destinationPath}
              onChange={(e) => setDestinationPath(e.target.value)}
              className="input-field slide-in"
            />
          </Box>

          <Box sx={{ mt: 4, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }} className="scale-in">
            <Button
              variant="contained"
              color="primary"
              onClick={checkConnection}
              disabled={loading.connection}
              className="control-button primary"
              startIcon={<CheckIcon />}
            >
              {loading.connection ? <CircularProgress size={24} /> : t('checkConnection')}
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={startDownload}
              disabled={loading.download || (Object.keys(downloadTasks).length > 0 && !isPaused)}
              className="control-button primary"
              startIcon={<PlayArrowIcon />}
            >
              {loading.download ? <CircularProgress size={24} /> : t('startDownload')}
            </Button>

            {Object.keys(downloadTasks).length > 0 && !loading.download && (
              <>
                <Button 
                  variant="contained" 
                  color="error" 
                  onClick={pauseDownload}
                  disabled={isPaused}
                  className="control-button error"
                  startIcon={<PauseIcon />}
                >
                  {t('pause')}
                </Button>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={clearDestination}
                  className="control-button"
                  startIcon={<DeleteIcon />}
                >
                  {isPaused ? t('clearDestination') : t('clearPrevious')}
                </Button>
              </>
            )}
          </Box>

          {isConnected && (
            <Typography variant="body1" color="success.main" sx={{ mb: 2 }} className="fade-in">
              {t('connected')}
            </Typography>
          )}

          {Object.keys(downloadTasks).length > 0 && (
            <Box className="progress-card fade-in">
              <Typography variant='h6' gutterBottom className="gradient-text">
                {t('downloadProgress')}
              </Typography>
              <Box className="fade-in">
                <Typography className="status-text">
                  {isPaused ? `⏸ ${t('downloadPaused')}` : `▶️ ${t('downloadInProgress')}`}
                  {isPaused && ` - ${t('clickToResume')}`}
                </Typography>
                <Box className="slider-container">
                  <Typography gutterBottom>
                    {t('concurrentDownloads')}: {concurrentDownloads}
                  </Typography>
                  <Slider
                    value={concurrentDownloads}
                    min={2}
                    max={100}
                    onChange={(_, value) => setConcurrentDownloads(value)}
                    onChangeCommitted={(_, value) => adjustConcurrentDownloads(value)}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 2, label: '2' },
                      { value: 100, label: '100' }
                    ]}
                  />
                </Box>
                <Typography className="status-text">
                  📁 {t('folderSize')}: {folderSize}
                </Typography>
                <Typography className="status-text">
                  📄 {t('files')}: {fileCount}
                </Typography>
              </Box>
              {speedHistory.length > 0 && (
                <Box className="chart-container fade-in">
                  <LineChart
                    xAxis={[{ data: Array.from({length: speedHistory.length}, (_, i) => i + 1).slice(-60), label: t('time') }]}
                    series={[
                      {
                        data: speedHistory.slice(-60),
                        label: t('downloadSpeed'),
                      },
                    ]}
                    yAxis={[{ label: 'MB/s', min: 0 }]}
                    height={200}
                    margin={{ left: 70 }}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
