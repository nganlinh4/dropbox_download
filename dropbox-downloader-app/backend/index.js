const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

let currentDownloadParams = null; // Store current download parameters

function getFolderSize(dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        totalSize += getFolderSize(filePath); // Recursive call for subdirectories
      } else {
        totalSize += stats.size;
      }
    }
  } catch (err) {
    console.error('Error calculating folder size:', err);
  }
  return totalSize;
}

// Function to count files in a directory recursively
function countFilesInDirectory(dirPath) {
  let totalFiles = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        totalFiles += countFilesInDirectory(itemPath); // Recursively count files in subdirectories
      } else {
        totalFiles++; // Count the file
      }
    }
  } catch (err) {
    console.error('Error counting files:', err);
  }
  return totalFiles;
}

// Endpoint to get current file count in destination folder
app.get('/api/file-count', (req, res) => {
  if (!currentDownloadParams || !currentDownloadParams.destinationPath) {
    return res.json({ count: 0 });
  }

  try {
    const fileCount = countFilesInDirectory(currentDownloadParams.destinationPath);
    res.json({ count: fileCount });
  } catch (error) {
    console.error('Error getting file count:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-connection', async (req, res) => {
  const { dropboxToken } = req.body;

  if (!dropboxToken) {
    return res.status(400).json({ error: 'Dropbox token is required' });
  }

  const dbx = new Dropbox({ accessToken: dropboxToken, fetch });

  try {
    const accountInfo = await dbx.usersGetCurrentAccount();
    res.json({ connected: true, accountInfo });
  } catch (error) {
    console.error('Error checking Dropbox connection:', error);
    res.status(500).json({ connected: false, error: error.message });
  }
});

app.post('/api/adjust-concurrent', async (req, res) => {
  const { count } = req.body;

  if (count < 2 || count > 100) {
    return res.status(400).json({ error: 'Count must be between 2 and 100' });
  }

  if (!currentDownloadParams) {
// Endpoint to get the current size of the destination folder
app.get('/api/folder-size', (req, res) => {
  if (!currentDownloadParams || !currentDownloadParams.destinationPath) {
    return res.json({ size: 0 });
  }

  try {
    const size = getFolderSize(currentDownloadParams.destinationPath);
    res.json({ size });
  } catch (error) {
    console.error('Error getting folder size:', error);
    res.status(500).json({ error: error.message });
  }
});

    return res.status(400).json({ error: 'No active download session' });
  }

  try {
    // Get all running random download processes
    const randomProcesses = Object.values(downloadProgressMap)
      .flatMap(info => info.processes)
      .filter(process => process.name === 'download_dropbox_random.py');

    const currentCount = randomProcesses.length;
    console.log(`Current random process count: ${currentCount}, requested: ${count}`);

    if (count > currentCount) {
      // Need to spawn more processes
      const toSpawn = count - currentCount;
      console.log(`Spawning ${toSpawn} new random download processes`);
      
      // Get the first download ID (assuming single download session)
      const activeDownloadId = Object.keys(downloadProgressMap)[0];
      
      if (activeDownloadId) {
        const { dropboxToken, sharedLink, destinationPath } = currentDownloadParams;
        
        for (let i = 0; i < toSpawn; i++) {
          const pyProcess = spawn('bash', ['-c',
            `source venv/bin/activate && python3 "${path.join(__dirname, 'download_dropbox_random.py')}" ` +
            `"${dropboxToken}" "${sharedLink}" "${destinationPath}" "download_dropbox_random.py"`
          ]);

          console.log(`Spawned new random download process with PID: ${pyProcess.pid}`);
          downloadProgressMap[activeDownloadId].processes.push({pid: pyProcess.pid, name: 'download_dropbox_random.py'});
          pidToDownloadId[pyProcess.pid] = activeDownloadId;
          
          // Set up event listeners for this process
          pyProcess.stdout.on('data', (data) => {
            const logMessage = `stdout (download_dropbox_random.py): ${data}`;
            console.log("Emitting log:", { type: 'stdout', message: logMessage, pid: pyProcess.pid });
            io.emit('log', { type: 'stdout', message: logMessage, pid: pyProcess.pid });
          });
          
          pyProcess.stderr.on('data', (data) => {
            const logMessage = `stderr (download_dropbox_random.py): ${data}`;
            console.log("Emitting log:", { type: 'stderr', message: logMessage, pid: pyProcess.pid });
            io.emit('log', { type: 'stderr', message: logMessage, pid: pyProcess.pid });
          });
          
          pyProcess.on('close', (code) => {
            console.log(`child process (download_dropbox_random.py) exited with code ${code}`);
            if (downloadProgressMap[activeDownloadId]) {
              const index = downloadProgressMap[activeDownloadId].processes.findIndex(p => p.pid === pyProcess.pid);
              if (index > -1) {
                downloadProgressMap[activeDownloadId].processes.splice(index, 1);
              }
            }
          });
        }
      }
    } else if (count < currentCount) {
      // Need to kill some processes
      const toKill = currentCount - count;
      console.log(`Killing ${toKill} random download processes`);
      const processesToKill = randomProcesses.slice(0, toKill);
      processesToKill.forEach(process => {
        console.log(`Killing process with PID: ${process.pid}`);
        require('child_process').spawn('kill', ['-9', process.pid.toString()]);
      });
    }

    res.json({ 
      message: 'Concurrent downloads adjusted successfully',
      currentCount: count,
      processPIDs: Object.values(downloadProgressMap)
        .flatMap(info => info.processes)
        .filter(process => process.name === 'download_dropbox_random.py')
        .map(process => process.pid)
    });
  } catch (error) {
    console.error('Error adjusting concurrent downloads:', error);
    res.status(500).json({ error: error.message });
  }
});
// Endpoint to get the current size of the destination folder
app.get('/api/folder-size', (req, res) => {
  if (!currentDownloadParams || !currentDownloadParams.destinationPath) {
    return res.json({ size: 0 });
  }

  try {
    const size = getFolderSize(currentDownloadParams.destinationPath);
    res.json({ size });
  } catch (error) {
    console.error('Error getting folder size:', error);
    res.status(500).json({ error: error.message });
  }
});


let downloadId;
let downloadProgressMap = {};
let pidToDownloadId = {};

app.post('/api/download', async (req, res) => {
  const { dropboxToken, sharedLink, destinationPath } = req.body;

  if (!dropboxToken || !sharedLink || !destinationPath) {
    return res.status(400).json({
      error: 'Dropbox token, shared link, and destination path are required',
    });
  }

  downloadId = uuidv4();
    downloadProgressMap[downloadId] = {
        totalFiles: 0,
        downloadedFiles: 0,
        currentFile: '',
        error: '',
        processes: [],
    };

  try {
    // Store current download parameters
    currentDownloadParams = {
      dropboxToken,
      sharedLink,
      destinationPath
    };

    const spawnPythonScript = (scriptName) => {
      const pyProcess = spawn('bash', ['-c',
        `source venv/bin/activate && python3 "${path.join(__dirname, scriptName)}" ` +
        `"${dropboxToken}" "${sharedLink}" "${destinationPath}" "${scriptName}"`
      ]);

      downloadProgressMap[downloadId].processes.push({ pid: pyProcess.pid, name: scriptName });
      pidToDownloadId[pyProcess.pid] = downloadId;

      pyProcess.stdout.on('data', (data) => {
        const logMessage = `stdout (${scriptName}): ${data}`;
        console.log("Emitting log:", { type: 'stdout', message: logMessage, pid: pyProcess.pid });
        io.emit('log', { type: 'stdout', message: logMessage, pid: pyProcess.pid });
      });

      pyProcess.stderr.on('data', (data) => {
        const logMessage = `stderr (${scriptName}): ${data}`;
        console.log("Emitting log:", { type: 'stderr', message: logMessage, pid: pyProcess.pid });
        io.emit('log', { type: 'stderr', message: logMessage, pid: pyProcess.pid });
      });

      pyProcess.on('close', (code) => {
        console.log(`child process (${scriptName}) exited with code ${code}`);
        if (downloadProgressMap[downloadId]) {
          const index = downloadProgressMap[downloadId].processes.findIndex(p => p.pid === pyProcess.pid);
          if (index > -1) {
            downloadProgressMap[downloadId].processes.splice(index, 1);
          }
        }
      });

      return pyProcess;
    };

    spawnPythonScript('download_dropbox.py');
    spawnPythonScript('download_dropbox_reverse.py');
    for (let i = 0; i < 20; i++) {
      spawnPythonScript('download_dropbox_random.py');
    }

    console.log('Download processes started successfully');
    res.json({ message: 'Download processes started', downloadId });
  } catch (error) {
    console.error('Error starting download:', error);
    currentDownloadParams = null;
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop-download', (req, res) => {
  try {
    Object.keys(downloadProgressMap).forEach(downloadId => {
      const progressInfo = downloadProgressMap[downloadId];
      if (progressInfo && progressInfo.processes) {
        progressInfo.processes.forEach(process => {
          try {
            require('child_process').spawn('kill', ['-9', process.pid.toString()]);
          } catch (err) {
            console.error(`Error killing process ${process.pid}:`, err);
          }
        });
      }
    });

    downloadProgressMap = {};
    pidToDownloadId = {};
    currentDownloadParams = null;
    processLogs = {};
    res.json({ message: 'Downloads stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('requestInitialFileList', async ({ dropboxToken, sharedLink }) => {
    if (!dropboxToken || !sharedLink) {
      socket.emit('initialFileList', { error: 'Dropbox token and shared link are required' });
      return;
    }
    const dbx = new Dropbox({ accessToken: dropboxToken, fetch });
    try {
      const result = await dbx.filesListFolder({
        path: '',
        shared_link: { url: sharedLink },
      });

      const entries = result.result.entries.map(entry => ({
        name: entry.name,
        type: entry['.tag'],
        path_lower: entry.path_lower,
        size: entry.size,
      }));
      socket.emit('initialFileList', { entries });

    } catch (error) {
      console.error('Error listing files:', error);
      socket.emit('initialFileList', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});