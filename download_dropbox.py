import dropbox
import os

from dotenv import load_dotenv
from dropbox.files import FolderMetadata, FileMetadata


load_dotenv()

# Dropbox access token and shared link configuration
DROPBOX_ACCESS_TOKEN = os.getenv("DROPBOX_ACCESS_TOKEN")
SHARED_LINK = os.getenv("SHARED_LINK")
DESTINATION_PATH = os.getenv("DESTINATION_PATH")

def should_download_file(local_file_path, dropbox_file):
    """Check if the file should be downloaded based on existence and size."""
    if not os.path.exists(local_file_path):
        return True
    
    # Compare file sizes
    local_size = os.path.getsize(local_file_path)
    dropbox_size = dropbox_file.size
    
    return local_size != dropbox_size

def download_shared_folder(dbx, shared_link_url, local_path, folder_path=""):
    """Download all contents from a Dropbox shared folder"""
    try:
        os.makedirs(local_path, exist_ok=True)
        
        # Ensure folder_path starts with a forward slash
        if folder_path and not folder_path.startswith("/"):
            folder_path = f"/{folder_path}"
        
        # Log the folder being processed
        print(f"Listing folder contents at path: '{folder_path}'")
        
        # List folder contents
        result = dbx.files_list_folder(
            path=folder_path,
            shared_link=dropbox.files.SharedLink(url=shared_link_url)
        )
        print(f"Entries found at '{folder_path}': {[entry.name for entry in result.entries]}")

        while True:
            for entry in result.entries:
                if isinstance(entry, FolderMetadata):
                    # Handle folders
                    folder_name = entry.name
                    local_folder_path = os.path.join(local_path, folder_name)
                    os.makedirs(local_folder_path, exist_ok=True)
                    print(f"Creating folder: {local_folder_path}")
                    
                    # Reconstruct the path for the subfolder
                    subfolder_path = os.path.join(folder_path, folder_name).replace("\\", "/")  # Ensure forward slashes
                    
                    # Recursively download contents of the folder
                    download_shared_folder(dbx, shared_link_url, local_folder_path, subfolder_path)

                elif isinstance(entry, FileMetadata):
                    # Handle files
                    file_name = entry.name
                    local_file_path = os.path.join(local_path, file_name)
                    
                    # Check if we should download the file
                    if should_download_file(local_file_path, entry):
                        print(f"Downloading file: {file_name} to {local_file_path}")
                        
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
                            print(f"Successfully downloaded: {file_name}")
                        except Exception as e:
                            print(f"Error downloading {file_name}: {e}")
                    else:
                        print(f"Skipping existing file: {file_name} (already downloaded)")

            if not result.has_more:
                break
            result = dbx.files_list_folder_continue(result.cursor)

    except dropbox.exceptions.ApiError as e:
        print(f"API Error: {e.user_message_text}")
    except Exception as e:
        import traceback
        print(f"General Error: {e}\n{traceback.format_exc()}")
    finally:
        print("Finished processing folder.")

def main():
    # Initialize Dropbox client
    dbx = dropbox.Dropbox(oauth2_access_token=DROPBOX_ACCESS_TOKEN)
    try:
        print(f"Starting download from Dropbox shared folder...")
        download_shared_folder(dbx, SHARED_LINK, DESTINATION_PATH)
        print("Download completed successfully!")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()