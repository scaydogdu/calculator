package httpapi

import (
	"log/slog"
	"net/http"
)

func addRoutes(mux *http.ServeMux, logger *slog.Logger, staticDir string) {
	mux.Handle("POST /api/v1/calculate", handleCalculate())
	mux.Handle("/api/v1/calculate", handleMethodNotAllowed(http.MethodPost))
	mux.Handle("GET /healthz", handleHealth())
	mux.Handle("/api/", handleNotFound())
	if staticDir != "" {
		logger.Info("serving static files", "dir", staticDir)
		mux.Handle("/", http.FileServer(http.Dir(staticDir)))
	}
}

func handleHealth() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
}

func handleMethodNotAllowed(allow string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", allow)
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "use "+allow)
	})
}

func handleNotFound() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "no such endpoint")
	})
}
