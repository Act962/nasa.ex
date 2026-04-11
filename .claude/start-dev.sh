#!/bin/sh
export PATH="/usr/local/bin:$PATH"
cd /Users/weydsonlima/nasaex-wey
exec /usr/local/bin/node node_modules/.bin/next dev --port 3001
