#!/bin/bash

# Open a new terminal and run download_dropbox.py
tmux new-session -d -s down_dropbox1 "bash -c 'python3 download_dropbox.py; exec bash'"

# Open another terminal and run download_dropbox_reverse.py
tmux new-session -d -s down_dropbox1 "bash -c 'python3 download_dropbox_reverse.py; exec bash'"

# Open 20 terminals running download_dropbox_random.py
for i in {3..20}; do
    tmux new-session -d -s down_dropbox$i "bash -c 'python3 download_dropbox_random.py; exec bash'"
done

# Attach to the first tmux session
tmux attach-session -t down_dropbox1
