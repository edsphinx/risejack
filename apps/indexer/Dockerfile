# RiseJack Indexer - Minimal Docker Image
# Multi-stage build for smallest possible image (~15MB)

# Stage 1: Build
FROM golang:1.23-alpine AS builder

# Install CA certificates for HTTPS
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy go mod files first (caching)
COPY go.mod go.sum ./

# Enable auto-download of newer Go toolchain if dependencies require it
ENV GOTOOLCHAIN=auto
RUN go mod download

# Copy source
COPY main.go ./

# Build static binary (CGO disabled for scratch compatibility)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o indexer .

# Stage 2: Minimal runtime
FROM scratch

# Copy CA certs for HTTPS/WSS connections
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=builder /app/indexer /indexer

# Run as non-root (UID 1000)
USER 1000

# Default command
ENTRYPOINT ["/indexer"]
