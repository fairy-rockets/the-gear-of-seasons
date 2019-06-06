package main

import (
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"

	log "github.com/sirupsen/logrus"

	"os/signal"
	"syscall"

	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/shelf"
	serverPkg "github.com/fairy-rockets/the-gear-of-seasons/web"
	"github.com/fatih/color"
)

//go:generate bash ../geninfo.sh

// Listen
var omoteListen = flag.String("listen-omote", ":8080", "omote listen")
var uraListen = flag.String("listen-ura", ":8081", "ura listen")

// Path
var shelfPath = flag.String("shelf", "_shelf", "shelf path")
var cachePath = flag.String("cache", "_cache", "cache path")

var shelf *shelfPkg.Shelf
var server *serverPkg.Server

func mainLoop() os.Signal {
	go func() {
		err := server.Start()
		if err != nil {
			log.Fatalf("Server aborted: %v", err)
		}
	}()

	sig := make(chan os.Signal)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case s := <-sig:
		if err := server.Stop(); err != nil {
			log.WithField("Module", "Web").Errorf("Error on stopping web: %v", err)
		} else {
			log.WithField("Module", "Web").Info("Stopped gracefully.")
		}
		return s
	}
}

func printLogo() {
	log.Info("****************************************")
	log.Info(color.BlueString("  the-gear-of-seasons  "))
	log.Info("****************************************")
	log.Info(color.MagentaString("%s", gitRev()))
	log.Infof("Build at: %s", color.MagentaString("%s", buildAt()))
}

func main() {
	//var err error

	printLogo()
	flag.Parse()
	log.Info("----------------------------------------")
	log.Info("Initializing...")
	log.Info("----------------------------------------")
	storage, err := shelfPkg.NewStorage(*shelfPath)
	if err != nil {
		log.Fatalf("Failed to prepare storage: %v", err)
	}
	shelf = shelfPkg.New(storage)
	if err := shelf.Init(); err != nil {
		log.Fatalf("Failed to prepare shelf: %v", err)
	}
	log.Infof("%d entities, %d moments", shelf.NumEntities(), shelf.NumMoments())

	server = serverPkg.NewServer(*omoteListen, *uraListen, shelf, *cachePath)
	if err := server.Prepare(); err != nil {
		log.Fatalf("Failed to prepare server: %v", err)
	}

	log.Info(color.GreenString("                                    [OK]"))

	log.Info("----------------------------------------")
	log.Info("Initialized.")
	log.Info("----------------------------------------")

	s := mainLoop()

	log.Fatalf("Signal (%v) received, stopping\n", s)
}
