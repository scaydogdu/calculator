# syntax=docker/dockerfile:1

FROM node:22.23.2-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.27.3-alpine AS api
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=api /out/server /server
COPY --from=web /web/dist /static
ENV PORT=8080 STATIC_DIR=/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
