
.PHONY: all
all: \
  .bin/the-gear-of-seasons \
  .bin/sanity-check \
  .bin/garbage-collect

.PHONY: clean
clean:
	rm -Rfv .bin

.bin/the-gear-of-seasons: $(shell find . -type f -name *.go)
	npm run build

.bin/sanity-check: $(shell find . -type f -name *.go)
	go generate ./cmd/sanity-check
	CGO_ENABLED=0 go build -o $@ ./cmd/sanity-check

.bin/garbage-collect: $(shell find . -type f -name *.go)
	go generate ./cmd/garbage-collect
	CGO_ENABLED=0 go build -o $@ ./cmd/garbage-collect
