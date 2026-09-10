#!/bin/sh
# Syntax-check the app script inside index.html without a build step.
cd "$(dirname "$0")/.."
L=$(grep -n '^const {useState' index.html | head -1 | cut -d: -f1)
awk -v s="$L" 'NR>=s' index.html | sed '/^<\/script>/,$d' > /tmp/bt_app_check.js && node --check /tmp/bt_app_check.js && echo "index.html script parses"
