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
	"github.com/fatih/color"
)

//go:generate bash ../geninfo.sh

var shelfPath = flag.String("shelf", "_shelf", "old-shelf path")

var shelf *shelfPkg.Shelf

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
	storage, err := shelfPkg.NewStorage(*shelfPath)
	if err != nil {
		log.Fatalf("Failed to prepare storage: %v", err)
	}
	shelf = shelfPkg.New(storage)
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
	f, err := os.Open(ent.SystemPath())
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.SystemPath())
	}
	defer f.Close()
	hasher := md5.New()
	_, err = io.Copy(hasher, f)
	if err != nil {
		log.Fatalf("Sanity check failed: %v\npath: %s", err, ent.SystemPath())
	}
	hash := hex.EncodeToString(hasher.Sum(nil)[:])
	if ent.ID() != hash {
		log.Fatalf(`Sanity check failed: hash mismatched!
path: %s
expected: %s
actual: %s`, err, ent.SystemPath(), hash, ent.ID())
	}
}
