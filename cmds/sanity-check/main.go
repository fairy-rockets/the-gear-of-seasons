package main

import (
	"crypto/md5"
	"encoding/hex"
	"flag"
	_ "image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"

	log "github.com/Sirupsen/logrus"

	shelfPkg "github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/fairy-rockets/the-gear-of-seasons/web"
	"github.com/fatih/color"
)

//go:generate bash ../geninfo.sh

var listenOmote = flag.String("listen-omote", ":8080", "omote listen")
var listenUra = flag.String("listen-ura", ":8081", "ura listen")
var shelfPath = flag.String("shelf", "_shelf", "old-shelf path")
var cachePath = flag.String("cache", "_cache", "cache path")

var shelf *shelfPkg.Shelf
var server *web.Server

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
	shelf = shelfPkg.New(*shelfPath)
	if err := shelf.Init(); err != nil {
		log.Fatalf("Failed to prepare shelf: %v", err)
	}
	log.Infof("%d entities, %d moments", shelf.NumEntities(), shelf.NumMoments())

	log.Info(color.GreenString("[OK]"))
	log.Info("----------------------------------------")
	log.Info("Checking Entities...")
	ents := shelf.FindAllEntities()
	for i, ent := range ents {
		checkEntity(ent)
		if (i+1)%100 == 0 {
			log.Infof("%d/%d(%d%%) ...", i+1, len(ents), (i+1)*100/len(ents))
		}
	}
	log.Info(color.GreenString("[OK]"))
}

func checkEntity(ent shelfPkg.Entity) {
	f, err := os.Open(ent.Path())
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.Path())
	}
	defer f.Close()
	hasher := md5.New()
	_, err = io.Copy(hasher, f)
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.Path())
	}
	hash := hex.EncodeToString(hasher.Sum(nil)[:])
	if ent.ID() != hash {
		log.Fatalf(`Sanity check failed: hash mismatched!
path: %s
expected: %s
actual: %s`, err, ent.Path(), hash, ent.ID())
	}
}
