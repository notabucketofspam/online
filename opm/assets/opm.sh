#!/bin/sh


if [ ! $(command -v node) ] && [ ! -x "./node" ]; then
  echo Gotta download node
  curl -O "https://waluigi-servebeer.com/dlc/opm/node.xz"
  xz --decompress --force "node.xz"
  chmod +x "./node"
  echo Done with that
fi

echo Loading...
curl -s -O "https://waluigi-servebeer.com/dlc/opm/opm.js"
clear

./node opm.js
read -p "Press any key to continue . . . "
