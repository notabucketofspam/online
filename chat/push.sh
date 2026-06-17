#!/bin/sh

rsync -az --delete ./dist/ cool:/httpd/chat/
echo rsync done
