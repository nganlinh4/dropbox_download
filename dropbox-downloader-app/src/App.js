import React, { useState, useEffect } from 'react';
import './App.css';
import {
  Container,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Box,
  CircularProgress,
} from '@mui/material';

function App() {
  const [dropboxToken, setDropboxToken] = useState('');
  const [sharedLink, setSharedLink] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [files, setFiles] = useState([]);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadProgress, setDownloadProgress] = useState({
    totalFiles: 0,
    downloadedFiles: 0,
    currentFile: '',
    error: '',
  });
  const [loading, setLoading] = useState({
    connection: false,
    listFiles: false,
    download: false,
  });

  useEffect(() => {
    let intervalId;

    if (downloadStatus === 'Download started') {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch('http://localhost:3001/api/progress');
          const data = await response.json();
          setDownloadProgress(data);

          if (data.error) {
            setDownloadStatus(`Error: ${data.error}`);
            clearInterval(intervalId);
          } else if (
            data.downloadedFiles === data.totalFiles &&
            data.totalFiles > 0
          ) {
            setDownloadStatus('Download complete!');
            clearInterval(intervalId);
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
          setDownloadStatus(
            'Error fetching progress. See console for details.'
          );
          clearInterval(intervalId);
        }
      }, 1000); // Check progress every second
    }

    return () => clearInterval(intervalId); // Cleanup on unmount or status change
  }, [downloadStatus]);

  const checkConnection = async () => {
    setLoading({ ...loading, connection: true });
    try {
      const response = await fetch(
        'http://localhost:3001/api/check-connection',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dropboxToken }),
        }
      );
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

  const listFiles = async () => {
    setLoading({ ...loading, listFiles: true });
    try {
      const response = await fetch('http://localhost:3001/api/list-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dropboxToken, sharedLink }),
      });
      const data = await response.json();

      if (response.ok) {
        setFiles(data.entries);
      } else {
        setFiles([]);
        alert(data.error || 'Failed to list files.');
      }
    } catch (error) {
      console.error('Error listing files:', error);
      setFiles([]);
      alert('Error listing files. See console for details.');
    } finally {
      setLoading({ ...loading, listFiles: false });
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
      setDownloadStatus(data.message);
    } catch (error) {
      console.error('Error starting download:', error);
      setDownloadStatus('Error starting download. See console for details.');
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

        <Button
          variant="contained"
          color="primary"
          onClick={checkConnection}
          disabled={loading.connection}
          sx={{ mr: 2 }}
        >
          {loading.connection ? (
            <CircularProgress size={24} />
          ) : (
            'Check Dropbox Connection'
          )}
        </Button>
        {isConnected && (
          <Typography variant="body1" color="success">
            Connected to Dropbox!
          </Typography>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={listFiles}
          disabled={loading.listFiles}
          sx={{ mr: 2 }}
        >
          {loading.listFiles ? <CircularProgress size={24} /> : 'List Files'}
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={startDownload}
          disabled={loading.download}
        >
          {loading.download ? <CircularProgress size={24} /> : 'Start Download'}
        </Button>

        {files.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Files:
            </Typography>
            <List>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${file.name} (${file.type})`}
                    secondary={file.size && `${file.size} bytes`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {downloadStatus && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body1">Status: {downloadStatus}</Typography>
            {downloadProgress.totalFiles > 0 && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={
                    (downloadProgress.downloadedFiles /
                      downloadProgress.totalFiles) *
                    100
                  }
                />
                <Typography variant="body2">
                  Progress: {downloadProgress.downloadedFiles} /{' '}
                  {downloadProgress.totalFiles}
                  {downloadProgress.currentFile &&
                    ` - Downloading: ${downloadProgress.currentFile}`}
                </Typography>
              </Box>
            )}
            {downloadProgress.error && (
              <Typography variant="body2" color="error">
                Error: {downloadProgress.error}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
