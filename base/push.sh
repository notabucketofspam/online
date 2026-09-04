#!/bin/sh
rsync \
  --compress \
  --times \
  --recursive \
  --include-from="./rsync-include.txt" \
  --exclude-from="./rsync-exclude.txt" \
  --delete \
  --copy-links \
  -e "ssh -i \"./notkeys/key\"" \
  ./ ubuntu@193.122.154.50:/httpd/online/
echo "rsync OK"
ssh -i "./notkeys/key" ubuntu@193.122.154.50 "~/restart-online"
# sleep 2
