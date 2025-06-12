#!/bin/bash

# Multi-platform Docker build script
# This script builds Docker images for both AMD64 and ARM64 architectures

set -e

# Default values
IMAGE_NAME="heimdall"
TAG="latest"
PUSH=false
USE_OPTIMIZED=false

# Function to show usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -n, --name NAME       Image name (default: heimdall)"
  echo "  -t, --tag TAG         Image tag (default: latest)"
  echo "  -p, --push           Push to registry"
  echo "  -o, --optimized      Use Dockerfile.optimized"
  echo "  -h, --help           Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                                    # Build locally for current platform"
  echo "  $0 -p                                # Build and push multi-platform"
  echo "  $0 -n mybot -t v1.0 -p              # Custom name/tag and push"
  echo "  $0 -o -p                            # Use optimized dockerfile and push"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  -n | --name)
    IMAGE_NAME="$2"
    shift 2
    ;;
  -t | --tag)
    TAG="$2"
    shift 2
    ;;
  -p | --push)
    PUSH=true
    shift
    ;;
  -o | --optimized)
    USE_OPTIMIZED=true
    shift
    ;;
  -h | --help)
    show_usage
    exit 0
    ;;
  *)
    echo "Unknown option: $1"
    show_usage
    exit 1
    ;;
  esac
done

# Set the dockerfile to use
if [ "$USE_OPTIMIZED" = true ]; then
  DOCKERFILE="Dockerfile.optimized"
else
  DOCKERFILE="Dockerfile"
fi

echo "Building multi-platform Docker image..."
echo "Image: $IMAGE_NAME"
echo "Tag: $TAG"
echo "Dockerfile: $DOCKERFILE"
echo "Push to registry: $PUSH"

# Create buildx builder if it doesn't exist
echo ""
echo "Setting up Docker buildx..."
docker buildx create --name multiplatform --use --bootstrap 2>/dev/null || {
  echo "Builder already exists or failed to create, using existing..."
  docker buildx use multiplatform 2>/dev/null || true
}

# Build command
BUILD_ARGS=(
  "buildx" "build"
  "--file" "$DOCKERFILE"
  "--tag" "${IMAGE_NAME}:${TAG}"
)

if [ "$PUSH" = true ]; then
  BUILD_ARGS+=("--platform" "linux/amd64,linux/arm64")
  BUILD_ARGS+=("--push")
else
  echo ""
  echo "Note: Building for local use (current platform only)."
  echo "For multi-platform builds, use --push flag."
  BUILD_ARGS+=("--load")
fi

BUILD_ARGS+=(".")

echo ""
echo "Executing: docker ${BUILD_ARGS[*]}"
docker "${BUILD_ARGS[@]}"

if [ $? -eq 0 ]; then
  echo ""
  echo "Build completed successfully!"
  if [ "$PUSH" = true ]; then
    echo "Images pushed to registry for both AMD64 and ARM64 platforms."
  else
    echo "Image built locally for current platform."
  fi
else
  echo ""
  echo "Build failed!"
  exit 1
fi
