#!/bin/bash

# thanks gemini
tell-hash(){
  local the_folder="$1"
  find "$the_folder" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
}
load-hash() {
  local the_hash_file="$1"
  awk '{print $1}' "$the_hash_file"
}

# check the number of parameters
if test "$#" -ne 2; then
  echo "Usage: $0 <folder_path> <hash_file.txt>"
  exit 2
fi

FOLDER="$1"
HASH_FILE="$2"

# check that the folder exists
if test ! -d "$FOLDER" ; then
  echo "Directory '$FOLDER' does not exist."
  exit 2
fi

# and also that the hash file exists
if test ! -f "$HASH_FILE"; then
  # echo "Hash file '$HASH_FILE' does not exist; gotta create it..."
  echo $(tell-hash "$FOLDER")>"$HASH_FILE"
  exit 1
fi

CURRENT_HASH=$(tell-hash "$FOLDER")

SAVED_HASH=$(load-hash "$HASH_FILE")

# compare those hashes
if test "$CURRENT_HASH" == "$SAVED_HASH"; then
  # echo "$FOLDER: same as it ever was"
  exit 0
else
  # echo "$FOLDER: changed"
  # echo $(tell-hash "$FOLDER")>"$HASH_FILE"
  exit 1
fi

