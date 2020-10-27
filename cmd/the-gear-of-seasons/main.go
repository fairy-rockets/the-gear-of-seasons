package main

import (
	"flag"
	"fmt"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"os/signal"
	"syscall"
	"time"

	serverPkg "github.com/fairy-rockets/the-gear-of-seasons/internal/server"
	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/internal/shelf"
	"github.com/mattn/go-isatty"
	"go.uber.org/zap"
)

//go:generate bash ../../scripts/generate-buildinfo.sh

// logging
var standardLog = flag.Bool("standard-log", false, "Show log human readably")

// Listen
var omoteListen = flag.String("listen-omote", ":8080", "omote listen")
var uraListen = flag.String("listen-ura", ":8081", "ura listen")

// Path
var shelfPath = flag.String("shelf", "_shelf", "shelf path")
var cachePath = flag.String("cache", "_cache", "cache path")

var shelf *shelfPkg.Shelf
var server *serverPkg.Server

func mainLoop() os.Signal {
	log := zap.L()
	go func() {
		err := server.Start()
		if err != nil {
			log.Fatal("Server aborted: %v", zap.Error(err))
		}
	}()

	sig := make(chan os.Signal)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case s := <-sig:
		if err := server.Stop(); err != nil {
			log.Error("Failed to stop web server", zap.Error(err))
		} else {
			log.Info("Web server stopped gracefully")
		}
		return s
	}
}

func printLogo() {
	log := zap.L()
	log.Info("****************************************")
	log.Info("  the-gear-of-seasons  ")
	log.Info("****************************************")
	log.Info("Build info", zap.String("revision", gitRev()), zap.String("build-at", buildAt()))
}

func main() {
	var err error
	var log *zap.Logger

	printLogo()
	flag.Parse()
	// Check is terminal
	if *standardLog || isatty.IsTerminal(os.Stdout.Fd()) || isatty.IsCygwinTerminal(os.Stdout.Fd()) {
		log, err = zap.NewDevelopment()
	} else {
		log, err = zap.NewProduction()
	}
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Failed to create logger: %v", err)
		os.Exit(-1)
	}
	undo := zap.ReplaceGlobals(log)
	defer undo()
	log.Info("----------------------------------------")
	log.Info("Initializing...")
	log.Info("----------------------------------------")
	log.Info("Log System Initialized.")
	{
		name, offset := time.Now().Zone()
		log.Info("Current timezone", zap.String("name", name), zap.Int("offset", offset))
	}

	storage, err := shelfPkg.NewStorage(*shelfPath)
	if err != nil {
		log.Fatal("Failed to prepare storage", zap.Error(err))
	}
	shelf = shelfPkg.New(storage)
	if err := shelf.Init(); err != nil {
		log.Fatal("Failed to prepare shelf", zap.Error(err))
	}
	log.Info("Initialized", zap.Int("num-entities", shelf.NumEntities()), zap.Int("num-moments", shelf.NumMoments()))

	server = serverPkg.New(*omoteListen, *uraListen, shelf, *cachePath)
	if err := server.Prepare(); err != nil {
		log.Fatal("Failed to prepare server", zap.Error(err))
	}

	log.Info("----------------------------------------")
	log.Info("Initialized.")
	log.Info("----------------------------------------")

	s := mainLoop()

	log.Fatal("Signal received, stopping\n", zap.String("signal", s.String()))
}
