import io from 'socket.io-client';
import React, { useState, useEffect } from 'react';
import './App.css';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Slider,
  CircularProgress,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';

function App() {
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
    let folderSizeIntervalId;
    let fileCountIntervalId;

    if (Object.keys(downloadTasks).length > 0) {
      // Monitor folder size
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
        const socket = io('http://localhost:3001');
        socket.on('connect', () => {
          console.log('Connected to backend via Socket.IO');
        });

      socket.on('log', (logData) => {
        console.log("Received log data:", logData); // Keep this
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
          setIsConnected(false);
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
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dropbox Downloader
        </Typography>

        <TextField
          label="Dropbox Access Token"
          fullWidth
          margin="normal"
          value={dropboxToken}
          onChange={(e) => setDropboxToken(e.target.value)}
        />

        <TextField
          label="Shared Link"
          fullWidth
          margin="normal"
          value={sharedLink}
          onChange={(e) => setSharedLink(e.target.value)}
        />

        <TextField
          label="Destination Path"
          fullWidth
          margin="normal"
          value={destinationPath}
          onChange={(e) => setDestinationPath(e.target.value)}
        />

        <Box sx={{ mt: 2, mb: 2, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={checkConnection}
            disabled={loading.connection}
          >
            {loading.connection ? <CircularProgress size={24} /> : 'Check Connection'}
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={startDownload}
            disabled={loading.download || (Object.keys(downloadTasks).length > 0 && !isPaused)}
          >
            {loading.download ? <CircularProgress size={24} /> : 'Start Download'}
          </Button>

          {Object.keys(downloadTasks).length > 0 && !loading.download && (
            <>
              <Button 
                variant="contained" 
                color="error" 
                onClick={pauseDownload}
                disabled={isPaused}
              >
                Pause
              </Button>
              <Button variant="contained" color="secondary" onClick={clearDestination}>
                {isPaused ? 'Clear Destination' : 'Clear Previous Files'}
              </Button>
            </>
          )}
        </Box>

        {isConnected && (
          <Typography variant="body1" color="success.main" sx={{ mb: 2 }}>
            Connected to Dropbox!
          </Typography>
        )}

        {Object.keys(downloadTasks).length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant='h6' gutterBottom>
              Download Progress
            </Typography>
            <Box sx={{ width: '100%', bgcolor: 'background.paper', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography sx={{ mt: 2 }}>
                {isPaused ? 'Download Paused' : 'Download in Progress'}
                {isPaused && ' - Click Start Download to resume'}
              </Typography>
              <Box sx={{ mt: 2, mb: 2, width: '100%', maxWidth: 500 }}>
                <Typography gutterBottom>
                  Concurrent Downloads: {concurrentDownloads}
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
              <Typography sx={{ mt: 1 }}>
                Folder Size: {folderSize}
              </Typography>
              <Typography sx={{ mt: 1 }}>Files: {fileCount}</Typography>
            </Box>
            {speedHistory.length > 0 && (
              <Box sx={{ mt: 2, width: '100%', maxWidth: 500 }}>
                <LineChart
                  xAxis={[{ data: Array.from({length: speedHistory.length}, (_, i) => i + 1).slice(-60), label: 'Time (s)' }]}
                  series={[
                    {
                      data: speedHistory.slice(-60),
                      label: 'Download Speed (MB/s)',
                    },
                  ]}
                  yAxis={[{ label: 'MB/s' }]}
                  height={200}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
