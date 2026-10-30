// Package httpapi exposes the calculator over HTTP/JSON.
package httpapi

import (
	"log/slog"
	"net/http"
	"time"
)

// NewServer returns the application's root handler. If staticDir is not
// empty, the built frontend is served from it.
func NewServer(logger *slog.Logger, staticDir string) http.Handler {
	mux := http.NewServeMux()
	addRoutes(mux, logger, staticDir)
	var h http.Handler = mux
	h = withRecover(logger, h)
	h = withLogging(logger, h)
	return h
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func withLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "duration", time.Since(start))
	})
}

func withRecover(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				logger.Error("panic", "value", v, "path", r.URL.Path)
				writeError(w, http.StatusInternalServerError, "internal_error", "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
