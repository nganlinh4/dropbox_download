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

// Store download progress
let downloadProgressMap = {}; // Map of downloadId to progress
let pidToDownloadId = {}; // Map of process PID to download ID
let currentDownloadParams = null; // Store current download parameters

// Download speed monitoring
let speedMonitorInterval = null;
let lastFolderSize = 0;
let currentTransferRate = 0;

function getFolderSize(dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        totalSize += getFolderSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (err) {
    console.error('Error calculating folder size:', err);
  }
  return totalSize;
}

function calculateTransferRate() {
  if (!currentDownloadParams) return;
  
  const currentSize = getFolderSize(currentDownloadParams.destinationPath);
  const transferredBytes = currentSize - lastFolderSize;
  currentTransferRate = transferredBytes;
  
  lastFolderSize = currentSize;
  
  if (transferredBytes > 0) {
    const mbTransferred = transferredBytes / (1024 * 1024);
    console.log(`Folder size changed by: ${transferredBytes} bytes in 5s`);
    console.log(`Transfer rate: ${mbTransferred.toFixed(2)} MB per 5s`);
  }
}

function startSpeedMonitoring() {
  console.log('Starting speed monitoring');
  stopSpeedMonitoring();
  lastFolderSize = getFolderSize(currentDownloadParams.destinationPath);
  currentTransferRate = 0;
  speedMonitorInterval = setInterval(calculateTransferRate, 5000);
}

function stopSpeedMonitoring() {
  if (speedMonitorInterval) {
    console.log('Stopping speed monitoring');
    clearInterval(speedMonitorInterval);
    speedMonitorInterval = null;
  }
  lastFolderSize = 0;
  currentTransferRate = 0;
}

app.get('/api/download-speed', (req, res) => {
  const mbPer5Sec = currentTransferRate / (1024 * 1024);
  res.json({ 
    speed: currentTransferRate,
    formatted: mbPer5Sec.toFixed(2)
  });
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
  
  if (count < 2 || count > 30) {
    return res.status(400).json({ error: 'Count must be between 2 and 30' });
  }

  if (!currentDownloadParams) {
    return res.status(400).json({ error: 'No active download session' });
  }

  try {
    const randomProcesses = Object.values(downloadProgressMap)
      .flatMap(info => info.processes)
      .filter(process => process.name === 'download_dropbox_random.py');

    const currentCount = randomProcesses.length;
    
    if (count > currentCount) {
      // Need to spawn more processes
      const toSpawn = count - currentCount;
      for (let i = 0; i < toSpawn; i++) {
        Object.keys(downloadProgressMap).forEach(downloadId => {
          const { dropboxToken, sharedLink, destinationPath } = currentDownloadParams;
          const pyProcess = spawn('bash', ['-c', 
            `source venv/bin/activate && python3 "${path.join(__dirname, 'download_dropbox_random.py')}" ` +
            `"${dropboxToken}" "${sharedLink}" "${destinationPath}" "download_dropbox_random.py"`
          ]);
          
          console.log(`Spawned new random download process with PID: ${pyProcess.pid}`);
          downloadProgressMap[downloadId].processes.push({pid: pyProcess.pid, name: 'download_dropbox_random.py'});
          pidToDownloadId[pyProcess.pid] = downloadId;
        });
      }
    } else if (count < currentCount) {
      // Need to kill some processes
      const toKill = currentCount - count;
      console.log(`Killing ${toKill} random download processes`);
      const processesToKill = randomProcesses.slice(0, toKill);
      processesToKill.forEach(process => {
        require('child_process').spawn('kill', ['-9', process.pid.toString()]);
      });
    }

    res.json({ message: 'Concurrent downloads adjusted successfully' });
  } catch (error) {
    console.error('Error adjusting concurrent downloads:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/download', async (req, res) => {
  const { dropboxToken, sharedLink, destinationPath } = req.body;

  if (!dropboxToken || !sharedLink || !destinationPath) {
    return res.status(400).json({
      error: 'Dropbox token, shared link, and destination path are required',
    });
  }

  const downloadId = uuidv4();
  downloadProgressMap[downloadId] = {
    totalFiles: 0,
    downloadedFiles: 0,
    currentFile: '',
    error: '',
    processes: [],
  };

  // Clear old progress files
  fs.readdirSync(__dirname).forEach(file => {
    if (file.startsWith("progress_")) {
      fs.unlinkSync(path.join(__dirname, file));
    }
  });

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

      downloadProgressMap[downloadId].processes.push({pid: pyProcess.pid, name: scriptName});
      pidToDownloadId[pyProcess.pid] = downloadId;

      pyProcess.stdout.on('data', (data) => {
        console.log(`stdout (${scriptName}): ${data}`);
      });

      pyProcess.stderr.on('data', (data) => {
        console.error(`stderr (${scriptName}): ${data}`);
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

    startSpeedMonitoring();

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
    delete downloadProgressMap[downloadId];
    stopSpeedMonitoring();
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/:downloadId', (req, res) => {
  const { downloadId } = req.params;
  let totalFiles = 0;
  let downloadedFiles = 0;
  let error = '';

  const progressInfo = downloadProgressMap[downloadId];
  if (!progressInfo) {
    return res.json({ totalFiles: 0, downloadedFiles: 0, error: 'Download ID not found' });
  }

  for (const processInfo of progressInfo.processes) {
    const { pid, name } = processInfo;
    const progressFile = path.join(__dirname, `progress_${name.replace('.py', '')}_${pid}.txt`);
    
    try {
      if (fs.existsSync(progressFile)) {
        const data = fs.readFileSync(progressFile, 'utf8');
        const [total, downloaded] = data.split(' ').map(Number);
        totalFiles += total;
        downloadedFiles += downloaded;
      }
    } catch (err) {
      error += `Error reading progress file ${progressFile}: ${err.message}; `;
    }
  }

  res.json({ totalFiles, downloadedFiles, error });
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

    // Clean up progress files
    fs.readdirSync(__dirname).forEach(file => {
      if (file.startsWith("progress_")) {
        fs.unlinkSync(path.join(__dirname, file));
      }
    });

    downloadProgressMap = {};
    pidToDownloadId = {};
    currentDownloadParams = null;
    stopSpeedMonitoring();
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