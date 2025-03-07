# Dropbox Downloader App

This application allows you to download files and folders from a shared Dropbox link with a modern, feature-rich interface.

## Features

- Parallel downloading with adjustable concurrent downloads (2-100)
- Real-time download progress monitoring
- Dark/Light theme support
- English/Korean language support
- Live download speed graph
- File count and folder size tracking
- Pause/Resume functionality
- Clear destination folder option

## Prerequisites

- Node.js and npm installed on your system.

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository_url>
    cd dropbox-downloader-app
    ```

2.  Install backend dependencies:

    ```bash
    cd backend
    npm install
    cd ..
    ```
3.  Install frontend dependencies:
    ```bash
    npm install
    ```

## Running with Virtual Environment

1.  Create a virtual environment in the `backend` directory:

    ```bash
    cd backend
    python3 -m venv venv
    ```

2.  Activate the virtual environment:

    ```bash
    source venv/bin/activate
    ```

3.  Install the required Python packages (do this every time you activate a fresh virtual environment):

    ```bash
    pip install dropbox
    pip install python-dotenv
    pip install requests
    ```

4.  Now you can run the backend server as described in the 'Running the App' section, and it will use the packages installed in the virtual environment.
## Running the App

1.  **Start the backend server:**

    ```bash
    cd dropbox-downloader-app/backend && source venv/bin/activate && npm run dev
    ```
   This will start the backend server, typically on port 3001.

2.  **Start the frontend development server:**
    In a separate terminal window, navigate to the project's root directory (`dropbox-downloader-app`) and run:
    ```bash    
    cd dropbox-downloader-app && npm start
    ```
    This will start the frontend development server and open the app in your default browser, usually at `http://localhost:3000`. If port 3000 is in use, it will choose another port.

## Configuration

1. You will need a Dropbox access token. You can create one in the [Dropbox App Console](https://www.dropbox.com/developers/apps). 
2. In the application, you'll need to provide:
   - Dropbox Access Token
   - Shared Link (the Dropbox folder you want to download)
   - Destination Path (where you want to save the files)

## Usage Tips

- Adjust concurrent downloads using the slider to optimize download speed for your connection
- Use the pause button to temporarily stop downloads and resume later
- Clear destination folder option is available to remove downloaded files when needed
