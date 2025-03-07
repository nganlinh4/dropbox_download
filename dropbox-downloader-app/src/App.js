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
  const [formattedSpeed, setFormattedSpeed] = useState('0.00 MB/s');
  const [speedHistory, setSpeedHistory] = useState([]);
  const [concurrentDownloads, setConcurrentDownloads] = useState(2);
  const [processLogs, setProcessLogs] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [downloadTasks, setDownloadTasks] = useState({});
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

  // Monitor download speed
  useEffect(() => {
    let intervalId;
    if (Object.keys(downloadTasks).length > 0) {
      intervalId = setInterval(async () => {
        const response = await fetch('http://localhost:3001/api/download-speed');
        if (response.ok) {
          const { formatted, average, history } = await response.json();
          setFormattedSpeed(`${average} MB/s`);
          setSpeedHistory(history);
        }
      }, 1000);
    }
    return () => clearInterval(intervalId);
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
      if (data.connected) {
        alert('Successfully connected to Dropbox!');
      } else {
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

  const stopDownload = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stop-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setDownloadTasks({});
        setProcessLogs({});
        setFormattedSpeed('0.00 MB/s');
      }
    } catch (error) {
      console.error('Error stopping download:', error);
      alert('Error stopping download. See console for details.');
    }
  };

  const startDownload = async () => {
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
            disabled={loading.download || Object.keys(downloadTasks).length > 0}
          >
            {loading.download ? <CircularProgress size={24} /> : 'Start Download'}
          </Button>

          {Object.keys(downloadTasks).length > 0 && (
            <Button variant="contained" color="error" onClick={stopDownload}>
              Stop Download
            </Button>
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
            <Box sx={{ width: '100%', bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
              <Typography sx={{ mt: 2 }}>Download Started</Typography>
              <Box sx={{ mt: 2, mb: 2, width: '100%', maxWidth: 500 }}>
                <Typography gutterBottom>
                  Concurrent Downloads: {concurrentDownloads}
                </Typography>
                <Slider
                  value={concurrentDownloads}
                  min={2}
                  max={30}
                  onChange={(_, value) => setConcurrentDownloads(value)}
                  onChangeCommitted={(_, value) => adjustConcurrentDownloads(value)}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 2, label: '2' },
                    { value: 30, label: '30' }
                  ]}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography>
                  Download Speed: {formattedSpeed}
                </Typography>
              </Box>
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
            {Object.keys(processLogs).length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {console.log("Current processLogs:", processLogs)}
                {Object.entries(processLogs).map(([pid, logs]) => (
                  <Box key={pid} sx={{ width: '48%', border: '1px solid grey', p: 1, maxHeight: '150px', overflowY: 'scroll' }}>
                    <Typography variant="subtitle2" component="div">
                      <strong>Process {pid}</strong>
                    </Typography>
                    {logs.map((log, index) => (
                      <div key={index} style={{ color: log.type === 'stderr' ? 'red' : 'black', whiteSpace: 'pre-wrap'  }}>
                        {log.message}
                      </div>
                    ))}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
