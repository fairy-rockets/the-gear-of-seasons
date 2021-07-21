#!/usr/bin/env bash
echo -n "$1: "
( find "$1" -type f -print0 | xargs -0 cat ) | wc -l | sed -e 's/[ \t]//g'
