#!/bin/bash

# Stop and delete all linh_down_dropbox sessions
for i in {1..20}; do
    tmux kill-session -t down_dropbox$i 2>/dev/null
done