package main

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestRunServesAPIAndShutsDown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	port := freePort(t)
	getenv := func(k string) string {
		if k == "PORT" {
			return port
		}
		return ""
	}
	errCh := make(chan error, 1)
	go func() { errCh <- run(ctx, getenv, io.Discard) }()

	base := "http://127.0.0.1:" + port
	waitForReady(t, base+"/healthz")

	resp, err := http.Post(base+"/api/v1/calculate", "application/json",
		strings.NewReader(`{"operation":"multiply","operands":[6,7]}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body struct{ Result float64 }
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.Result != 42 {
		t.Fatalf("result = %v (err %v), want 42", body.Result, err)
	}

	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("run returned %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestRunFailsOnBadPort(t *testing.T) {
	getenv := func(k string) string {
		if k == "PORT" {
			return "not-a-port"
		}
		return ""
	}
	if err := run(context.Background(), getenv, io.Discard); err == nil {
		t.Fatal("expected an error")
	}
}

func freePort(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return strconv.Itoa(l.Addr().(*net.TCPAddr).Port)
}

func waitForReady(t *testing.T, url string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if resp, err := http.Get(url); err == nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("%s not ready", url)
}
