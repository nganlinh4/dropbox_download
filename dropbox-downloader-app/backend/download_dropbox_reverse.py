import dropbox
import os
import sys
import time
from dropbox.files import FolderMetadata, FileMetadata

def write_progress(total_files, downloaded_files, script_name):
    pid = os.getpid()
    filename = f"progress_{script_name}_{pid}.txt"
    with open(filename, "w") as f:
        f.write(f"{total_files} {downloaded_files}")

def should_download_file(local_file_path, dropbox_file):
    """Check if the file should be downloaded based on existence and size."""
    if not os.path.exists(local_file_path):
        return True

    # Compare file sizes
    local_size = os.path.getsize(local_file_path)
    dropbox_size = dropbox_file.size

    return local_size != dropbox_size

def download_shared_folder(dbx, shared_link_url, local_path, folder_path="", total_files=0, downloaded_files=0, script_name="download_dropbox_reverse"):
    """Download all contents from a Dropbox shared folder in reverse order."""
    try:
        os.makedirs(local_path, exist_ok=True)

        # Ensure folder_path starts with a forward slash
        if folder_path and not folder_path.startswith("/"):
            folder_path = f"/{folder_path}"

        # List folder contents
        result = dbx.files_list_folder(
            path=folder_path,
            shared_link=dropbox.files.SharedLink(url=shared_link_url)
        )

        total_files += len(result.entries)
        write_progress(total_files, downloaded_files, script_name)

        while True:
            # Iterate in reverse order
            for entry in reversed(result.entries):
                if isinstance(entry, FolderMetadata):
                    # Handle folders
                    folder_name = entry.name
                    local_folder_path = os.path.join(local_path, folder_name)
                    os.makedirs(local_folder_path, exist_ok=True)

                    # Reconstruct the path for the subfolder
                    subfolder_path = os.path.join(folder_path, folder_name).replace("\\", "/")  # Ensure forward slashes

                    # Recursively download contents of the folder
                    total_files, downloaded_files = download_shared_folder(dbx, shared_link_url, local_folder_path, subfolder_path, total_files, downloaded_files, script_name)

                elif isinstance(entry, FileMetadata):
                    # Handle files
                    file_name = entry.name
                    local_file_path = os.path.join(local_path, file_name)

                    # Check if we should download the file
                    if should_download_file(local_file_path, entry):
                        try:
                            # Reconstruct the path for the file
                            file_path = os.path.join(folder_path, file_name).replace("\\", "/")  # Ensure forward slashes

                            # Download the file using the shared link
                            _, response = dbx.sharing_get_shared_link_file(
                                url=shared_link_url,
                                path=file_path
                            )
                            with open(local_file_path, "wb") as f:
                                f.write(response.content)
                            downloaded_files += 1
                            write_progress(total_files, downloaded_files, script_name)
                        except Exception as e:
                            print(f"Error downloading {file_name}: {e}")
                    else:
                        downloaded_files += 1
                        write_progress(total_files, downloaded_files, script_name)
                        print(f"Skipping existing file: {file_name} (already downloaded)")

            if not result.has_more:
                break
            result = dbx.files_list_folder_continue(result.cursor)
            total_files += len(result.entries)
            write_progress(total_files, downloaded_files, script_name)

    except dropbox.exceptions.ApiError as e:
        print(f"API Error: {e.user_message_text}")
    except Exception as e:
        import traceback
        print(f"General Error: {e}\n{traceback.format_exc()}")
    finally:
        print("Finished processing folder.")
    return total_files, downloaded_files

def initialize_dropbox_client(access_token):
    """Initialize and return a Dropbox client."""
    return dropbox.Dropbox(oauth2_access_token=access_token)

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python download_dropbox_reverse.py <dropbox_token> <shared_link> <destination_path> <script_name>")
        sys.exit(1)

    dropbox_token = sys.argv[1]
    shared_link = sys.argv[2]
    destination_path = sys.argv[3]
    script_name = sys.argv[4]

    dbx = initialize_dropbox_client(dropbox_token)
    download_shared_folder(dbx, shared_link, destination_path, script_name=script_name)