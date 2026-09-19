#!/bin/sh

rsync -az --delete ./dist/ cool:/httpd/dlc/chat/
echo rsync done
