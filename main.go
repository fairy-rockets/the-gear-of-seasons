package main

import (
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"

	log "github.com/Sirupsen/logrus"

	"os/signal"
	"syscall"

	"github.com/FairyRockets/the-gear-of-seasons/entity"
	"github.com/FairyRockets/the-gear-of-seasons/moment"
	"github.com/FairyRockets/the-gear-of-seasons/web"
	"github.com/fatih/color"
)

//go:generate bash geninfo.sh

var addr = flag.String("listen", ":8080", "listen")

func mainLoop() os.Signal {
	var err error
	entities := entity.NewStore("_entities")
	if err = entities.Init(); err != nil {
		log.Fatalf("Error while loading entities: %v", err)
	}
	moments := moment.NewStore("_moments")
	if err = moments.Init(); err != nil {
		log.Fatalf("Error while loading moments: %v", err)
	}

	log.Infof("%d entities, %d moments", entities.Size(), moments.Size())

	srv := web.NewWebServer(*addr, entities, moments)
	srv.Prepare()
	go srv.Start()

	sig := make(chan os.Signal)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case s := <-sig:
		if err := srv.Stop(); err != nil {
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

	log.Info(color.GreenString("                                    [OK]"))

	log.Info("----------------------------------------")
	log.Info("Initialized.")
	log.Info("----------------------------------------")

	s := mainLoop()

	log.Fatalf("Signal (%v) received, stopping\n", s)
}
