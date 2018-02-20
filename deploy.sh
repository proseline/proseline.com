#!/bin/bash
set -e
BUILD=build
ROOT=/var/www/proseline.com
FLAGS="--verbose --checksum --recursive --sparse --compress --human-readable --progress"
REF=${1:-HEAD}
(
	set -e
  GITDIR=$(pwd)
  TMPDIR=$(mktemp -d)
	trap '{ cd $GITDIR ; rm -rf $TMPDIR; exit 255; }' SIGINT EXIT
	git clone -s "$GITDIR" "$TMPDIR"
	cd "$TMPDIR"
	npm install
	NODE_ENV=production npm run build
	rsync $FLAGS $BUILD/* "node@proseline.com:$ROOT"
)
TAGNAME="deployed-$(date --iso-8601=seconds --utc | tr -d ':' | sed 's/+0000//')"
git tag "$TAGNAME"
git push origin "$TAGNAME"
