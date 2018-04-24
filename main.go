package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"

	log "github.com/Sirupsen/logrus"

	"github.com/FairyRockets/the-gear-of-seasons/web"
	"github.com/fatih/color"
)

//go:generate bash geninfo.sh

var addr = flag.String("listen", ":8080", "listen")

func mainLoop(sig <-chan os.Signal) os.Signal {
	srv := web.NewWebServer(*addr)

	go srv.Start()

	select {
	case s := <-sig:
		if err := srv.Stop(); err != nil {
			log.Errorf("Error on stopping web: %v", err)
		}
		return s
	}
}

func printLogo() {
	log.Info("****************************************")
	log.Info(color.BlueString("  the-gear-of-seasons  "))
	log.Info("****************************************")
	log.Infof("Build at: %s", color.MagentaString("%s", buildAt()))
	log.Infof("Git Revision: \n%s", color.MagentaString("%s", gitRev()))
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

	sig := make(chan os.Signal)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	s := mainLoop(sig)
	log.Fatalf("Signal (%v) received, stopping\n", s)
}
