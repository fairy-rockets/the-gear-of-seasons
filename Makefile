.PHONY: gen run get clean

pkg=github.com/FairyRockets/the-gear-of-seasons

all: gen .bin/the-gear-of-seasons

run: all
	.bin/the-gear-of-seasons

get:
	go get -u "github.com/Sirupsen/logrus"
	go get -u "github.com/fatih/color"
	go get -u "github.com/julienschmidt/httprouter"

gen:
	go generate $(pkg)

.bin/the-gear-of-seasons: $(shell find . -type f -name '*.go')
	@mkdir -p .bin
	go build -o $@ $(pkg)

clean:
	rm -rf .bin
	go clean $(pkg)/...
