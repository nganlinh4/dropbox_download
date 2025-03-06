import React, { useState, useEffect } from 'react';
import './App.css';

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
          } else if (data.downloadedFiles === data.totalFiles && data.totalFiles > 0) {
            setDownloadStatus('Download complete!');
            clearInterval(intervalId);
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
          setDownloadStatus('Error fetching progress. See console for details.');
          clearInterval(intervalId);
        }
      }, 1000); // Check progress every second
    }

    return () => clearInterval(intervalId); // Cleanup on unmount or status change
  }, [downloadStatus]);

  const checkConnection = async () => {
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
    }
  };

  const listFiles = async () => {
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
    }
  };

  const startDownload = async () => {
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
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Dropbox Downloader</h1>
        <div>
          <label htmlFor="dropboxToken">Dropbox Access Token:</label>
          <input
            type="text"
            id="dropboxToken"
            value={dropboxToken}
            onChange={(e) => setDropboxToken(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="sharedLink">Shared Link:</label>
          <input
            type="text"
            id="sharedLink"
            value={sharedLink}
            onChange={(e) => setSharedLink(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="destinationPath">Destination Path:</label>
          <input
            type="text"
            id="destinationPath"
            value={destinationPath}
            onChange={(e) => setDestinationPath(e.target.value)}
          />
        </div>
        <button onClick={checkConnection}>Check Dropbox Connection</button>
        {isConnected && <p>Connected to Dropbox!</p>}
        <button onClick={listFiles}>List Files</button>
        <button onClick={startDownload}>Start Download</button>

        {files.length > 0 && (
          <div>
            <h2>Files:</h2>
            <ul>
              {files.map((file, index) => (
                <li key={index}>
                  {file.name} ({file.type}) {file.size && ` - ${file.size} bytes`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {downloadStatus && (
          <div>
            <p>Status: {downloadStatus}</p>
            {downloadProgress.totalFiles > 0 && (
              <p>
                Progress: {downloadProgress.downloadedFiles} / {downloadProgress.totalFiles}
                {downloadProgress.currentFile && ` - Downloading: ${downloadProgress.currentFile}`}
              </p>
            )}
            {downloadProgress.error && <p>Error: {downloadProgress.error}</p>}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
