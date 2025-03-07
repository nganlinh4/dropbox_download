# Dropbox Downloader App

This application allows you to download files and folders from a shared Dropbox link.

## Prerequisites

- Node.js and npm installed on your system.
- A Dropbox access token with the necessary permissions to access the shared link.

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
You will need a Dropbox access token. You can create one in the Dropbox App Console. Provide this token to the application in the appropriate input field.
