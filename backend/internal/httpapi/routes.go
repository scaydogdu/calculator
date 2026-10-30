package httpapi

import (
	"log/slog"
	"net/http"
	"os"
	"path"
)

func addRoutes(mux *http.ServeMux, logger *slog.Logger, staticDir string) {
	mux.Handle("POST /api/v1/calculate", handleCalculate())
	mux.Handle("POST /api/v1/evaluate", handleEvaluate())
	mux.Handle("/api/v1/evaluate", handleMethodNotAllowed(http.MethodPost))
	mux.Handle("/api/v1/calculate", handleMethodNotAllowed(http.MethodPost))
	mux.Handle("GET /healthz", handleHealth())
	mux.Handle("/api/", handleNotFound())
	if staticDir != "" {
		logger.Info("serving static files", "dir", staticDir)
		mux.Handle("/", http.FileServer(noDirectoryListing{http.Dir(staticDir)}))
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
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method must be "+allow+".")
	})
}

func handleNotFound() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "No such endpoint.")
	})
}

// noDirectoryListing serves directory index pages without exposing file inventories.
type noDirectoryListing struct{ http.FileSystem }

func (fs noDirectoryListing) Open(name string) (http.File, error) {
	f, err := fs.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if info.IsDir() {
		index, err := fs.FileSystem.Open(path.Join(name, "index.html"))
		if err != nil {
			f.Close()
			return nil, os.ErrNotExist
		}
		indexInfo, err := index.Stat()
		index.Close()
		if err != nil || indexInfo.IsDir() {
			f.Close()
			return nil, os.ErrNotExist
		}
	}
	return f, nil
}
