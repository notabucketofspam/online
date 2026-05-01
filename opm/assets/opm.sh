#!/bin/sh

cd "$(dirname "$(readlink -f "$0")")"
nodecmd="node"
if [ ! $(command -v node) ]; then
  nodecmd="./node"
  if [ ! -x "./node" ]; then
    echo Gotta download node
    curl -O "https://waluigi-servebeer.com/dlc/opm/node.xz"
    xz --decompress --force "node.xz"
    chmod +x "./node"
    echo Done with that
  fi
fi

echo Loading...
curl -s -O "https://waluigi-servebeer.com/dlc/opm/opm.js"

$nodecmd opm.js
