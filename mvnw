#!/bin/sh
set -eu
BASE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
MAVEN_VERSION=3.9.11
MAVEN_DIR="$BASE_DIR/.mvn/wrapper/apache-maven-$MAVEN_VERSION"
if [ ! -x "$MAVEN_DIR/bin/mvn" ]; then
  mkdir -p "$BASE_DIR/.mvn/wrapper"
  ARCHIVE="$BASE_DIR/.mvn/wrapper/apache-maven-$MAVEN_VERSION-bin.tar.gz"
  if [ ! -f "$ARCHIVE" ]; then
    curl -fsSL "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MAVEN_VERSION/apache-maven-$MAVEN_VERSION-bin.tar.gz" -o "$ARCHIVE"
  fi
  tar -xzf "$ARCHIVE" -C "$BASE_DIR/.mvn/wrapper"
fi
exec "$MAVEN_DIR/bin/mvn" "$@"
