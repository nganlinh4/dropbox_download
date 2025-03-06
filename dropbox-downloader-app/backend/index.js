const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for the frontend origin
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Store download progress
let downloadProgress = {
  totalFiles: 0,
  downloadedFiles: 0,
  currentFile: '',
  error: '',
};

// Endpoint to check Dropbox connection
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

// Endpoint to list files in a shared folder
app.post('/api/list-files', async (req, res) => {
  const { dropboxToken, sharedLink } = req.body;

  if (!dropboxToken || !sharedLink) {
    return res.status(400).json({ error: 'Dropbox token and shared link are required' });
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
      size: entry.size, // Only for files
    }));

    res.json({ entries });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to start the download
app.post('/api/download', async (req, res) => {
  const { dropboxToken, sharedLink, destinationPath } = req.body;

  if (!dropboxToken || !sharedLink || !destinationPath) {
    return res.status(400).json({
      error: 'Dropbox token, shared link, and destination path are required',
    });
  }

  const dbx = new Dropbox({ accessToken: dropboxToken, fetch });

  // Reset download progress
    downloadProgress = {
        totalFiles: 0,
        downloadedFiles: 0,
        currentFile: '',
        error: '',
    };

  try {
    // Call a function to start the download process in the background.
    startDownload(dbx, sharedLink, destinationPath);
    res.json({ message: 'Download started' });
  } catch (error) {
    console.error('Error starting download:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get download progress
app.get('/api/progress', (req, res) => {
    res.json(downloadProgress);
});

async function downloadSharedFolder(dbx, sharedLink, localPath, folderPath = "") {
    try {
        fs.mkdirSync(localPath, { recursive: true });

        if (folderPath && !folderPath.startsWith("/")) {
            folderPath = `/${folderPath}`;
        }

        let result = await dbx.filesListFolder({
            path: folderPath,
            shared_link: { url: sharedLink },
        });

        downloadProgress.totalFiles += result.result.entries.length;

        while (true) {
            for (const entry of result.result.entries) {
                if (entry['.tag'] === 'folder') {
                    const folderName = entry.name;
                    const localFolderPath = path.join(localPath, folderName);
                    fs.mkdirSync(localFolderPath, { recursive: true });
                    const subfolderPath = path.join(folderPath, folderName).replace("\\", "/");

                    await downloadSharedFolder(dbx, sharedLink, localFolderPath, subfolderPath);
                } else if (entry['.tag'] === 'file') {
                    const fileName = entry.name;
                    const localFilePath = path.join(localPath, fileName);

                    if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size !== entry.size) {
                        downloadProgress.currentFile = fileName;
                        try {
                            const filePath = path.join(folderPath, fileName).replace("\\", "/");
                            const { result: fileData } = await dbx.sharingGetSharedLinkFile({
                                url: sharedLink,
                                path: filePath,
                            });

                            fs.writeFileSync(localFilePath, fileData.fileBinary);
                            downloadProgress.downloadedFiles++;

                        } catch (error) {
                            console.error(`Error downloading ${fileName}:`, error);
                            downloadProgress.error = `Error downloading ${fileName}: ${error.message}`;
                        }
                    } else {
                        downloadProgress.downloadedFiles++;
                        downloadProgress.currentFile = fileName;
                    }
                }
            }

            if (!result.result.has_more) {
                break;
            }
            result = await dbx.filesListFolderContinue({ cursor: result.result.cursor });
            downloadProgress.totalFiles += result.result.entries.length;

        }
    } catch (error) {
        console.error("Error:", error);
        downloadProgress.error = `Error: ${error.message}`;
    } finally {
        downloadProgress.currentFile = '';
    }
}

// Function for starting the download
function startDownload(dbx, sharedLink, destinationPath) {
  console.log(
    `Starting download from ${sharedLink} to ${destinationPath} with Dropbox instance`
  );
    downloadSharedFolder(dbx, sharedLink, destinationPath);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});