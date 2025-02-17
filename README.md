# Dropbox Folder Downloader

A tool to efficiently download large Dropbox folders that are typically difficult to download directly from the Dropbox website. Uses parallel downloading to improve speed.

## Setup

1. Create a `.env` file with:
```
DROPBOX_ACCESS_TOKEN=your_access_token
SHARED_LINK=your_dropbox_shared_link
DESTINATION_PATH=local_download_path
```

2. Install requirements:
```bash
pip install dropbox python-dotenv
```

## Usage

1. Start downloading:
```bash
./run.sh
```

2. Stop downloading:
```bash
./stop.sh
```

The tool creates multiple download processes using different ordering strategies (normal, reverse, random) to maximize download speed.