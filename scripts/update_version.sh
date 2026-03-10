#!/bin/bash
version=$(git describe --tags --exact-match HEAD --exclude "edge" 2>/dev/null || git rev-parse --short HEAD)

echo "Building the version file with version: $version"

echo "export const version = \"$version\";" > ./version.ts