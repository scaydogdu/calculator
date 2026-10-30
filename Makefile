.PHONY: test coverage run-backend run-frontend docker

test:
	cd backend && go vet ./... && go test ./... -race
	cd frontend && npm run lint && npm run typecheck && npm test

coverage:
	cd backend && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | tail -1 && go tool cover -html=coverage.out -o coverage.html
	cd frontend && npm run coverage

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

docker:
	docker build -t calculator . && docker run --rm -p 8080:8080 calculator
